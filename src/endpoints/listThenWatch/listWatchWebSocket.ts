/* eslint-disable max-lines-per-function */
/**
 * WebSocket endpoint that performs a Kubernetes "list then watch" for arbitrary resources.
 * - Sends an INITIAL snapshot (optionally paginated) followed by streaming watch events.
 * - Supports field/label selectors, namespace scoping, and pagination via `continue`.
 * - Resilient to 410 Gone (expired resourceVersion) by re-listing and resuming.
 */

import { Request } from 'express'
import WebSocket from 'ws'
import { WebsocketRequestHandler } from 'express-ws'
import * as k8s from '@kubernetes/client-node'
import { createUserKubeClient } from 'src/constants/kubeClients'
import { DEVELOPMENT } from 'src/constants/envs'
import { userKubeApi } from 'src/constants/httpAgent'
import { filterHeadersFromEnv } from 'src/utils/filterHeadersFromEnv'

/** Kubernetes watch phases we care about (including BOOKMARKs for RV advancement). */
type TWatchPhase = 'ADDED' | 'MODIFIED' | 'DELETED' | 'BOOKMARK'

/** Triple that identifies a K8s resource endpoint. group omitted/empty => core API. */
type ApiTriple = {
  apiGroup?: string // undefined or '' => core
  apiVersion: string
  plural: string // resource plural (e.g., "pods", "deployments")
}

/**
 * Type guard: checks that an unknown object looks like a K8s resource with metadata.
 */
const isKubeObject = (
  obj: unknown,
): obj is { metadata?: { name?: string; resourceVersion?: string; creationTimestamp?: string } } => {
  if (!obj || typeof obj !== 'object') return false
  const md = (obj as any).metadata
  return !!md && typeof md === 'object' && typeof md.name === 'string'
}

/**
 * Returns true if an error indicates resourceVersion expiry (HTTP 410 Gone / Expired).
 * Used to trigger a re-list.
 */
const isGone410 = (err: unknown): boolean => {
  const anyErr = err as any
  return (
    anyErr?.statusCode === 410 ||
    anyErr?.code === 410 ||
    anyErr?.status === 410 ||
    anyErr?.body?.code === 410 ||
    anyErr?.body?.reason === 'Expired' ||
    anyErr?.body?.reason === 'Gone'
  )
}

/**
 * Best-effort parse for a positive integer limit, otherwise returns undefined.
 */
const parseLimit = (val: string | null): number | undefined => {
  if (!val) return undefined
  const n = Number(val)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : undefined
}

/** Join multiple same-named query params (e.g. ?labelSelector=a=1&labelSelector=b=2) with commas */
const getJoinedParam = (url: URL, key: string): string | undefined => {
  const values = url.searchParams
    .getAll(key)
    .map(v => v.trim())
    .filter(Boolean)
  if (values.length === 0) return undefined
  return values.join(',')
}

/**
 * Attempt to decode a possibly double-encoded string safely.
 * If decoding fails, returns original.
 */
const safeDecode = (s?: string) => {
  if (!s) return undefined
  try {
    const once = decodeURIComponent(s)
    // If decoding still leaves encoded chars, try one more time
    return once.includes('%') ? decodeURIComponent(once) : once
  } catch {
    return s // not encoded; leave as-is
  }
}

/**
 * WebSocket handler: lists a page of resources, sends it as INITIAL, then starts a watch.
 * It rotates watches periodically and on failures, handling 410 by re-listing.
 */
export const listWatchWebSocket: WebsocketRequestHandler = async (ws: WebSocket, req: Request) => {
  console.log(`[${new Date().toISOString()}]: Incoming WebSocket connection (list-then-watch)`, {
    url: req.url,
  })

  // Pass-through only the safe, whitelisted headers (e.g. auth/cookie) based on env.
  const headers: Record<string, string | string[] | undefined> = filterHeadersFromEnv(req)

  // --- Parse and normalize query params ---
  const reqUrl = new URL(req.url || '', `http://${req.headers.host}`)
  const namespace = reqUrl.searchParams.get('namespace') || undefined
  const initialLimit = parseLimit(reqUrl.searchParams.get('limit'))
  const initialContinue = reqUrl.searchParams.get('_continue') || undefined
  const apiGroup = reqUrl.searchParams.get('apiGroup') || undefined // empty or undefined => core
  const apiVersion = reqUrl.searchParams.get('apiVersion') || ''
  const plural = reqUrl.searchParams.get('plural') || ''
  // Support both canonical and shorthand selector keys
  const fieldSelectorRaw = getJoinedParam(reqUrl, 'fieldSelector') ?? getJoinedParam(reqUrl, 'field')
  const labelSelectorRaw = getJoinedParam(reqUrl, 'labelSelector') ?? getJoinedParam(reqUrl, 'labels')
  const fieldSelector = safeDecode(fieldSelectorRaw)
  const labelSelector = safeDecode(labelSelectorRaw)
  const sinceRV = reqUrl.searchParams.get('sinceRV') || undefined // starting RV to resume from client

  // Validate required params up-front
  if (!apiVersion || !plural) {
    // 1008 = policy violation; used here as a generic "bad request" close reason
    ws.close(1008, 'apiVersion and plural are required')
    return
  }

  const target: ApiTriple = { apiGroup: apiGroup || undefined, apiVersion: apiVersion, plural }

  console.log(`[${new Date().toISOString()}]: Query params parsed:`, {
    namespace,
    initialLimit,
    initialContinue,
    apiGroup: target.apiGroup,
    apiVersion: target.apiVersion,
    plural: target.plural,
    sinceRV,
  })
  console.log(`[${new Date().toISOString()}]: Selectors:`, { fieldSelector, labelSelector })

  // Construct a per-user kube client (auth taken from filtered headers).
  const userKube = createUserKubeClient(headers)
  console.log(`[${new Date().toISOString()}]: Created Kubernetes client for user`)

  // Watch helper from k8s client
  const watch = new k8s.Watch(userKube.kubeConfig)

  // --- Connection + watch state ---
  let closed = false
  let lastRV: string | undefined = sinceRV // seed from client for resume
  let sentInitial = false
  let abortCurrentWatch: (() => void) | null = null
  let startingWatch = false

  // Resolve base path for list/watch depending on core vs. aggregated API group
  const isCore = !target.apiGroup || target.apiGroup === ''
  const listBasePath = isCore ? `/api/${target.apiVersion}` : `/apis/${target.apiGroup}/${target.apiVersion}`
  const listPath = namespace
    ? `${listBasePath}/namespaces/${namespace}/${target.plural}`
    : `${listBasePath}/${target.plural}`
  const watchPath = listPath

  console.log(`[${new Date().toISOString()}]: Using listPath/watchPath:`, listPath)

  /**
   * Helper to send server-side logs down the WS for client visibility.
   * This is best-effort; errors are swallowed.
   */
  const sendServerLog = (level: 'info' | 'warn' | 'error', msg: string) => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'SERVER_LOG', level, message: msg }))
      }
    } catch {
      console.error('Failed to send console to frontend')
    }
  }

  /**
   * Helper to send initial list page error.
   */
  const sendInitialError = (msg: string) => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'INITIAL_ERROR', message: msg }))
      }
    } catch {
      console.error('Failed to send console to frontend')
    }
  }

  // -------- LIST HELPERS --------

  // Build querystring for list call. Note: K8s uses 'continue' (not '_continue').
  const buildListQS = ({
    limit,
    _continue,
    resourceVersion,
    resourceVersionMatch,
  }: {
    limit?: number
    _continue?: string
    resourceVersion?: string
    resourceVersionMatch?: 'NotOlderThan' | 'Exact'
  }) => {
    const sp = new URLSearchParams()
    if (typeof limit === 'number') sp.set('limit', String(limit))
    if (_continue) sp.set('continue', _continue)
    if (fieldSelector) sp.set('fieldSelector', fieldSelector)
    if (labelSelector) sp.set('labelSelector', labelSelector)
    if (resourceVersion) sp.set('resourceVersion', resourceVersion)
    if (resourceVersionMatch) sp.set('resourceVersionMatch', resourceVersionMatch)
    const s = sp.toString()
    return s ? `?${s}` : ''
  }

  /**
   * Fetch a single list page.
   * - If `_continue` is absent and `lastRV` exists, we pass RV with `NotOlderThan` for consistent-ish reads.
   * - Optionally capture the returned `metadata.resourceVersion` into `lastRV`.
   */
  const listPage = async ({
    limit,
    _continue,
    captureRV,
  }: {
    limit?: number
    _continue?: string
    captureRV: boolean
  }) => {
    console.log(`[${new Date().toISOString()}]: Listing page`, { limit, _continue, captureRV, lastRV })

    // Refresh filtered headers each call in case env-driven filters change per-request.
    const filteredHeaders = filterHeadersFromEnv(req)

    const qs = buildListQS({
      limit,
      _continue,
      resourceVersion: !_continue && lastRV ? lastRV : undefined,
      resourceVersionMatch: !_continue && lastRV ? 'NotOlderThan' : undefined,
    })

    // Use shared Axios instance that routes via user agent + cluster origin.
    const { data: body } = await userKubeApi.get(`${listPath}${qs}`, {
      headers: {
        // Authorization and cookies are forwarded via filterHeadersFromEnv unless in DEVELOPMENT
        ...(DEVELOPMENT ? {} : filteredHeaders),
        'Content-Type': 'application/json',
      },
    })

    const items: any[] = Array.isArray(body.items) ? body.items : []

    // Sort newest-first by creationTimestamp, tiebreaker by resourceVersion (descending).
    items.sort((a, b) => {
      const ta = a.metadata?.creationTimestamp ? Date.parse(a.metadata.creationTimestamp) : 0
      const tb = b.metadata?.creationTimestamp ? Date.parse(b.metadata.creationTimestamp) : 0
      if (tb !== ta) return tb - ta
      const rva = Number(a.metadata?.resourceVersion ?? 0)
      const rvb = Number(b.metadata?.resourceVersion ?? 0)
      return rvb - rva
    })

    const meta = body.metadata || {}
    console.log(`[${new Date().toISOString()}]: List page received`, {
      itemCount: items.length,
      continue: meta._continue,
      resourceVersion: meta.resourceVersion,
    })

    if (captureRV) lastRV = meta.resourceVersion
    return {
      items,
      continue: meta._continue as string | undefined,
      remainingItemCount: meta.remainingItemCount as number | undefined,
      resourceVersion: meta.resourceVersion as string | undefined,
    }
  }

  // -------- WATCH HANDLERS --------

  /**
   * k8s watch event callback. Updates lastRV on BOOKMARK/ADDED/MODIFIED/DELETED and forwards to client.
   */
  const onEvent = (phase: string, obj: unknown) => {
    console.log(`[${new Date().toISOString()}]: Watch event fired:`, phase)
    if (closed) return
    const p = phase as TWatchPhase

    // BOOKMARK only advances the RV, no item payload to stream.
    if (p === 'BOOKMARK' && obj && typeof obj === 'object') {
      const md = (obj as any).metadata
      if (md?.resourceVersion) lastRV = md.resourceVersion
      console.log(`[${new Date().toISOString()}]: Bookmark event, updated RV:`, lastRV)
      return
    }

    // Forward resource events; also update RV from the object's metadata.
    if ((p === 'ADDED' || p === 'MODIFIED' || p === 'DELETED') && isKubeObject(obj)) {
      const rv = obj.metadata?.resourceVersion
      if (rv) lastRV = rv
      console.log(`[${new Date().toISOString()}]: Event:`, p, 'name:', obj.metadata?.name, 'RV:', rv)
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: p, item: obj }))
        }
      } catch (error) {
        console.warn(`[${new Date().toISOString()}]: Failed to send signal:`, {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          error: error,
        })
      }
    }
  }

  /**
   * k8s watch error callback. If 410 Gone, attempts to re-list to refresh RV; then restarts watch.
   */
  const onError = async (err: unknown) => {
    console.error(`[${new Date().toISOString()}]: Watch error:`, err)
    if (closed) return
    if (isGone410(err)) {
      console.warn(`[${new Date().toISOString()}]: 410 Gone detected, resetting list page`)
      try {
        await listPage({ limit: initialLimit, _continue: undefined, captureRV: true })
      } catch (error) {
        sendServerLog('error', `[${new Date().toISOString()}]: Failed to reset listPage after 410`)
        console.error(`[${new Date().toISOString()}]: Failed to reset listPage after 410:`, {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          error: error,
        })
      }
    }
    // Debounced restart to avoid tight loops.
    setTimeout(() => void startWatch(), 1200)
  }

  /**
   * (Re)start a watch against the resource path using the latest known resourceVersion (if any).
   * Ensures any existing watch is aborted before starting a new one.
   */
  const startWatch = async (): Promise<void> => {
    console.log(`[${new Date().toISOString()}]: Starting watch...`)
    if (closed || startingWatch) {
      console.log(`[${new Date().toISOString()}]: Skipping watch start, closed or already starting`)
      return
    }
    startingWatch = true
    try {
      // Abort/destroy previous watch if still active.
      if (abortCurrentWatch) {
        console.log(`[${new Date().toISOString()}]: Aborting existing watch before starting new one`)
        try {
          abortCurrentWatch()
        } catch {
          console.warn(`[${new Date().toISOString()}]: Failed to abort existing watch`)
        }
        abortCurrentWatch = null
      }

      // Assemble watch options; enable bookmarks for periodic RV updates.
      const watchOpts: any = {
        fieldSelector,
        labelSelector,
        allowWatchBookmarks: true,
      }
      if (lastRV) {
        watchOpts.resourceVersion = lastRV
        // resourceVersionMatch 'NotOlderThan' isn't supported by all watch servers here, so omitted.
      }

      console.log(`[${new Date().toISOString()}]: Watch options:`, watchOpts)
      const reqObj = await watch.watch(watchPath, watchOpts, onEvent, onError)
      console.log(`[${new Date().toISOString()}]: Watch established`)

      // Save aborter that tries both abort() and destroy() safely.
      abortCurrentWatch = () => {
        console.log(`[${new Date().toISOString()}]: Aborting watch...`)
        try {
          ;(reqObj as any)?.abort?.()
        } catch {
          console.warn(`[${new Date().toISOString()}]: Abort failed`)
        }
        try {
          ;(reqObj as any)?.destroy?.()
        } catch {
          console.warn(`[${new Date().toISOString()}]: Destroy failed`)
        }
      }
    } catch (error) {
      sendServerLog('error', `[${new Date().toISOString()}]: Error starting watch`)
      console.error(`[${new Date().toISOString()}]: Error starting watch:`, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        error: error,
      })
      // If the failure is due to expired RV, re-list to refresh RV and retry.
      if (!closed && isGone410(error)) {
        console.warn(`[${new Date().toISOString()}]: Re-listing after 410 on watch start`)
        try {
          await listPage({ limit: initialLimit, _continue: undefined, captureRV: true })
        } catch (error) {
          sendServerLog('error', `[${new Date().toISOString()}]: Failed re-list after 410`)
          console.error(`[${new Date().toISOString()}]: Failed re-list after 410:`, {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            error: error,
          })
        }
      }
      // Mild backoff to avoid thrashing.
      setTimeout(() => void startWatch(), 2000)
    } finally {
      startingWatch = false
    }
  }

  // -------- INITIAL LIST + BOOT WATCH --------

  try {
    console.log(`[${new Date().toISOString()}]: Performing initial list...`)
    const page = await listPage({
      limit: initialLimit,
      _continue: initialContinue,
      captureRV: true,
    })

    // Send the initial snapshot exactly once.
    if (!sentInitial && ws.readyState === WebSocket.OPEN) {
      sentInitial = true
      console.log(`[${new Date().toISOString()}]: Sending INITIAL snapshot to client`)
      try {
        ws.send(
          JSON.stringify({
            type: 'INITIAL',
            items: page.items,
            continue: page.continue,
            remainingItemCount: page.remainingItemCount,
            resourceVersion: page.resourceVersion,
          }),
        )
      } catch (error) {
        sendInitialError(`[${new Date().toISOString()}]: Failed to send INITIAL page`)
        sendServerLog('error', `[${new Date().toISOString()}]: Failed to send INITIAL page`)
        console.error(`[${new Date().toISOString()}]: Failed to send INITIAL page:`, {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          error: error,
        })
      }
    }
  } catch (error) {
    // If the initial list fails, we still proceed to attempt a watch so the client gets errors later.
    sendInitialError(`[${new Date().toISOString()}]: Initial list failed`)
    sendServerLog('error', `[${new Date().toISOString()}]: Initial list failed`)
    console.error(`[${new Date().toISOString()}]: Initial list failed:`, {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error: error,
    })
    sentInitial = true
  }

  // Start the first watch and set up periodic rotation to mitigate stuck TCPs/proxies.
  void startWatch()
  const rotateIv = setInterval(
    () => {
      console.log(`[${new Date().toISOString()}]: Periodic watch rotation triggered`)
      void startWatch()
    },
    10 * 60 * 1000, // every 10 minutes
  )

  // -------- CLIENT MESSAGES (pagination requests) --------

  ws.on('message', async data => {
    console.log(`[${new Date().toISOString()}]: Received WS message:`, data.toString())
    if (closed) return
    let msg: any
    try {
      msg = JSON.parse(String(data))
    } catch {
      console.warn(`[${new Date().toISOString()}]: Invalid JSON from client`)
      return
    }

    // Client asks to fetch the next page from the Kubernetes list API.
    if (msg?.type === 'SCROLL') {
      console.log(`[${new Date().toISOString()}]: Client requested SCROLL:`, msg)
      const limit = typeof msg.limit === 'number' && msg.limit > 0 ? Math.trunc(msg.limit) : undefined
      const token = typeof msg.continue === 'string' ? msg.continue : undefined
      if (!token) return

      try {
        const page = await listPage({ limit, _continue: token, captureRV: false })
        console.log(`[${new Date().toISOString()}]: Sending PAGE to client:`, { count: page.items.length })
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'PAGE',
              items: page.items,
              continue: page.continue,
              remainingItemCount: page.remainingItemCount,
            }),
          )
        }
      } catch (error) {
        sendServerLog('error', `[${new Date().toISOString()}]: Page fetch failed`)
        console.error(`[${new Date().toISOString()}]: Page fetch failed:`, {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          error: error,
        })
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'PAGE_ERROR', error: 'Failed to load next page' }))
        }
      }
    }
  })

  // -------- LIVENESS / CLEANUP --------

  // Simple heartbeat: client should respond with 'pong'.
  let isAlive = true
  ;(ws as any).on?.('pong', () => {
    console.log(`[${new Date().toISOString()}]: Pong received from client`)
    isAlive = true
  })

  // Ping every 25s. If no pong before next tick, terminate.
  const pingIv = setInterval(() => {
    try {
      if ((ws as any).readyState !== WebSocket.OPEN) return
      if (!isAlive) {
        console.warn(`[${new Date().toISOString()}]: No pong received — terminating socket`)
        ;(ws as any).terminate?.()
        return
      }
      isAlive = false
      console.log(`[${new Date().toISOString()}]: Sending ping to client`)
      ;(ws as any).ping?.()
    } catch (error) {
      console.error(`[${new Date().toISOString()}]: Ping error (ignored):`, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        error: error,
      })
    }
  }, 25_000)

  /**
   * Centralized cleanup to stop timers and abort any active watch.
   * Called on WS close/error.
   */
  const cleanup = () => {
    console.log(`[${new Date().toISOString()}]: Cleaning up WebSocket and watchers`)
    closed = true
    clearInterval(pingIv)
    clearInterval(rotateIv)
    try {
      abortCurrentWatch?.()
    } catch {
      console.warn(`[${new Date().toISOString()}]: Abort during cleanup failed`)
    }
    abortCurrentWatch = null
  }

  // Close + error handling for the socket.
  ;(ws as any).on?.('close', () => {
    console.log(`[${new Date().toISOString()}]: WebSocket closed`)
    cleanup()
  })
  ;(ws as any).on?.('error', err => {
    console.error(`[${new Date().toISOString()}]: WebSocket error:`, err)
    cleanup()
    try {
      ;(ws as any).close?.()
    } catch (error) {
      console.error(`[${new Date().toISOString()}]: Error closing WS after error (ignored):`, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        error: error,
      })
    }
  })
}
