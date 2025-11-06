/* eslint-disable max-lines-per-function */
import { Request } from 'express'
import WebSocket from 'ws'
import { WebsocketRequestHandler } from 'express-ws'
import * as k8s from '@kubernetes/client-node'
import { createUserKubeClient } from 'src/constants/kubeClients'
import { filterHeadersFromEnv } from 'src/utils/filterHeadersFromEnv'
import { eventSortKey } from './utils'

type TWatchPhase = 'ADDED' | 'MODIFIED' | 'DELETED' | 'BOOKMARK'

const isEventsV1Event = (obj: unknown): obj is k8s.EventsV1Event => {
  if (obj === null || typeof obj !== 'object') return false
  const maybe = obj as Record<string, unknown>
  if (!('metadata' in maybe) || typeof maybe.metadata !== 'object' || maybe.metadata === null) return false
  const md = maybe.metadata as Record<string, unknown>
  return typeof md.name === 'string'
}

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

const parseLimit = (val: string | null): number | undefined => {
  if (!val) return undefined
  const n = Number(val)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : undefined
}

/** Join multiple query params (e.g. ?labelSelector=a=1&labelSelector=b=2) with commas */
const getJoinedParam = (url: URL, key: string): string | undefined => {
  const values = url.searchParams
    .getAll(key)
    .map(v => v.trim())
    .filter(Boolean)
  if (values.length === 0) return undefined
  return values.join(',')
}

export const eventsWebSocket: WebsocketRequestHandler = async (ws: WebSocket, req: Request) => {
  console.log(`[${new Date().toISOString()}]: Incoming WebSocket connection for events`)

  const headers: Record<string, string | string[] | undefined> = filterHeadersFromEnv(req)

  const reqUrl = new URL(req.url || '', `http://${req.headers.host}`)
  const namespace = reqUrl.searchParams.get('namespace') || undefined
  const initialLimit = parseLimit(reqUrl.searchParams.get('limit'))
  const initialContinue = reqUrl.searchParams.get('_continue') || undefined
  console.log(`[${new Date().toISOString()}]: Query params parsed:`, { namespace, initialLimit, initialContinue })

  const fieldSelector = getJoinedParam(reqUrl, 'fieldSelector') ?? getJoinedParam(reqUrl, 'field')
  const labelSelector = getJoinedParam(reqUrl, 'labelSelector') ?? getJoinedParam(reqUrl, 'labels')
  const sinceRV = reqUrl.searchParams.get('sinceRV') || undefined

  console.log(`[${new Date().toISOString()}]: Selectors:`, { fieldSelector, labelSelector, sinceRV })

  const userKube = createUserKubeClient(headers)
  console.log(`[${new Date().toISOString()}]: Created Kubernetes client for user`)

  const watch = new k8s.Watch(userKube.kubeConfig)
  const evApi = userKube.kubeConfig.makeApiClient(k8s.EventsV1Api)

  let closed = false
  // Seed lastRV from client if provided (so we can resume)
  let lastRV: string | undefined = sinceRV
  let sentInitial = false
  let abortCurrentWatch: (() => void) | null = null
  let startingWatch = false

  const watchPath = namespace
    ? `/apis/events.k8s.io/v1/namespaces/${namespace}/events`
    : `/apis/events.k8s.io/v1/events`

  console.log(`[${new Date().toISOString()}]: Using watchPath:`, watchPath)

  const listPage = async ({
    limit,
    _continue,
    captureRV,
  }: {
    limit?: number
    _continue?: string
    captureRV: boolean
  }) => {
    console.log(`[${new Date().toISOString()}]: Listing page of events`, { limit, _continue, captureRV, lastRV })

    const baseOpts: k8s.EventsV1ApiListEventForAllNamespacesRequest = {
      fieldSelector,
      labelSelector,
      limit: typeof limit === 'number' ? limit : undefined,
      _continue,
    }

    if (!_continue && lastRV) {
      baseOpts.resourceVersion = lastRV
      baseOpts.resourceVersionMatch = 'NotOlderThan'
    }

    const resp = namespace
      ? await evApi.listNamespacedEvent({ namespace, ...baseOpts })
      : await evApi.listEventForAllNamespaces(baseOpts)

    const items = (resp.items ?? []) as k8s.EventsV1Event[]
    items.sort((a, b) => eventSortKey(b) - eventSortKey(a)) // newest first

    console.log(`[${new Date().toISOString()}]: List page received`, {
      // itemCount: resp.items?.length,
      itemCount: items.length,
      continue: resp.metadata?._continue,
      resourceVersion: resp.metadata?.resourceVersion,
    })

    if (captureRV) lastRV = resp.metadata?.resourceVersion
    return {
      // items: resp.items ?? [],
      items,
      continue: resp.metadata?._continue,
      remainingItemCount: resp.metadata?.remainingItemCount,
      resourceVersion: resp.metadata?.resourceVersion,
    }
  }

  const onEvent = (phase: string, obj: unknown) => {
    console.log(`[${new Date().toISOString()}]: Watch event fired:`, phase)
    if (closed) return
    const p = phase as TWatchPhase

    if (p === 'BOOKMARK' && obj && typeof obj === 'object') {
      const md = (obj as any).metadata
      if (md?.resourceVersion) lastRV = md.resourceVersion
      console.log(`[${new Date().toISOString()}]: Bookmark event, updated RV:`, lastRV)
      return
    }

    if ((p === 'ADDED' || p === 'MODIFIED' || p === 'DELETED') && isEventsV1Event(obj)) {
      const rv = obj.metadata?.resourceVersion
      if (rv) lastRV = rv
      console.log(`[${new Date().toISOString()}]: Event:`, p, 'name:', obj.metadata?.name, 'RV:', rv)
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: p, item: obj }))
        }
      } catch (error) {
        console.warn(`[${new Date().toISOString()}]: Failed to send event:`, {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          error: error,
        })
      }
    }
  }

  const onError = async (err: unknown) => {
    console.error(`[${new Date().toISOString()}]: Watch error:`, err)
    if (closed) return
    if (isGone410(err)) {
      console.warn(`[${new Date().toISOString()}]: 410 Gone detected, resetting list page`)
      try {
        await listPage({ limit: initialLimit, _continue: undefined, captureRV: true })
      } catch (error) {
        console.error(`[${new Date().toISOString()}]: Failed to reset listPage after 410:`, {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          error: error,
        })
      }
    }
    // Restart the watch after a short delay; ensure we stop the current one first
    setTimeout(() => void startWatch(), 1200)
  }

  const startWatch = async (): Promise<void> => {
    console.log(`[${new Date().toISOString()}]: Starting watch...`)
    if (closed || startingWatch) {
      console.log(`[${new Date().toISOString()}]: Skipping watch start, closed or already starting`)
      return
    }
    startingWatch = true
    try {
      if (abortCurrentWatch) {
        console.log(`[${new Date().toISOString()}]: Aborting existing watch before starting new one`)
        try {
          abortCurrentWatch()
        } catch {
          console.warn(`[${new Date().toISOString()}]: Failed to abort existing watch`)
        }
        abortCurrentWatch = null
      }

      const watchOpts: any = {
        fieldSelector,
        labelSelector,
        allowWatchBookmarks: true,
      }
      if (lastRV) {
        watchOpts.resourceVersion = lastRV
        // watchOpts.resourceVersionMatch = 'NotOlderThan'
      }

      console.log(`[${new Date().toISOString()}]: Watch options:`, watchOpts)
      const reqObj = await watch.watch(watchPath, watchOpts, onEvent, onError)
      console.log(`[${new Date().toISOString()}]: Watch established`)
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
      console.error(`[${new Date().toISOString()}]: Error starting watch:`, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        error: error,
      })
      if (!closed && isGone410(error)) {
        console.warn(`[${new Date().toISOString()}]: Re-listing after 410 on watch start`)
        try {
          await listPage({ limit: initialLimit, _continue: undefined, captureRV: true })
        } catch (error) {
          console.error(`[${new Date().toISOString()}]: Failed re-list after 410:`, {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            error: error,
          })
        }
      }
      setTimeout(() => void startWatch(), 2000)
    } finally {
      startingWatch = false
    }
  }

  try {
    console.log(`[${new Date().toISOString()}]: Performing initial list...`)
    const page = await listPage({
      limit: initialLimit,
      _continue: initialContinue,
      captureRV: true,
    })

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
        console.error(`[${new Date().toISOString()}]: Failed to send INITIAL page:`, {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          error: error,
        })
      }
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}]: Initial list failed:`, {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error: error,
    })
    sentInitial = true
  }

  void startWatch()
  const rotateIv = setInterval(
    () => {
      console.log(`[${new Date().toISOString()}]: Periodic watch rotation triggered`)
      void startWatch()
    },
    10 * 60 * 1000,
  )

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

  let isAlive = true
  ;(ws as any).on?.('pong', () => {
    console.log(`[${new Date().toISOString()}]: Pong received from client`)
    isAlive = true
  })

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
