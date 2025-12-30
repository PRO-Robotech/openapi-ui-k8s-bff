/* eslint-disable max-lines-per-function */
import { Request } from 'express'
import WebSocket from 'ws'
import { WebsocketRequestHandler } from 'express-ws'
import { DEVELOPMENT } from 'src/constants/envs'
import { userKubeApi } from 'src/constants/httpAgent'
import { filterHeadersFromEnv } from 'src/utils/filterHeadersFromEnv'
import { eventSortKey } from './utils'
import { TWatchPhase, TEventsV1Event } from './types'

const isEventsV1Event = (obj: unknown): obj is TEventsV1Event => {
  if (obj === null || typeof obj !== 'object') return false
  const maybe = obj as Record<string, unknown>
  const md = maybe.metadata as any
  return !!md && typeof md === 'object' && typeof md.name === 'string'
}

const isGone410 = (err: unknown): boolean => {
  const anyErr = err as any
  return (
    anyErr?.statusCode === 410 ||
    anyErr?.code === 410 ||
    anyErr?.status === 410 ||
    anyErr?.body?.code === 410 ||
    anyErr?.body?.reason === 'Expired' ||
    anyErr?.body?.reason === 'Gone' ||
    anyErr?.reason === 'Expired' ||
    anyErr?.reason === 'Gone'
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

/** Attempt to decode a possibly encoded string safely. */
const safeDecode = (s?: string) => {
  if (!s) return undefined
  try {
    const once = decodeURIComponent(s)
    return once.includes('%') ? decodeURIComponent(once) : once
  } catch {
    return s
  }
}

export const eventsWebSocket: WebsocketRequestHandler = async (ws: WebSocket, req: Request) => {
  console.log(`[${new Date().toISOString()}]: Incoming WebSocket connection for events`)

  const reqUrl = new URL(req.url || '', `http://${req.headers.host}`)
  const namespace = reqUrl.searchParams.get('namespace') || undefined
  const initialLimit = parseLimit(reqUrl.searchParams.get('limit'))
  const initialContinue = reqUrl.searchParams.get('_continue') || undefined
  const sinceRV = reqUrl.searchParams.get('sinceRV') || undefined

  const fieldSelectorRaw = getJoinedParam(reqUrl, 'fieldSelector') ?? getJoinedParam(reqUrl, 'field')
  const labelSelectorRaw = getJoinedParam(reqUrl, 'labelSelector') ?? getJoinedParam(reqUrl, 'labels')
  const fieldSelector = safeDecode(fieldSelectorRaw)
  const labelSelector = safeDecode(labelSelectorRaw)

  console.log(`[${new Date().toISOString()}]: Query params parsed:`, {
    namespace,
    initialLimit,
    initialContinue,
    sinceRV,
  })
  console.log(`[${new Date().toISOString()}]: Selectors:`, { fieldSelector, labelSelector })

  let closed = false
  // Seed lastRV from client if provided (so we can resume)
  let lastRV: string | undefined = sinceRV
  let sentInitial = false
  let abortCurrentWatch: (() => void) | null = null
  let startingWatch = false

  const listPath = namespace ? `/apis/events.k8s.io/v1/namespaces/${namespace}/events` : `/apis/events.k8s.io/v1/events`

  const watchPath = listPath

  console.log(`[${new Date().toISOString()}]: Using listPath/watchPath:`, listPath)

  // K8s list uses "continue" (not "_continue"). Metadata field is usually "continue" too.
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

    const filteredHeaders = filterHeadersFromEnv(req)
    const qs = buildListQS({
      limit,
      _continue,
      resourceVersion: !_continue && lastRV ? lastRV : undefined,
      resourceVersionMatch: !_continue && lastRV ? 'NotOlderThan' : undefined,
    })

    const { data: body } = await userKubeApi.get(`${listPath}${qs}`, {
      headers: {
        ...(DEVELOPMENT ? {} : filteredHeaders),
        'Content-Type': 'application/json',
      },
    })

    const items: TEventsV1Event[] = Array.isArray(body?.items) ? body.items : []
    items.sort((a, b) => eventSortKey(b as any) - eventSortKey(a as any)) // newest first

    const meta = body?.metadata || {}
    const cont = (meta.continue ?? meta._continue) as string | undefined

    console.log(`[${new Date().toISOString()}]: List page received`, {
      itemCount: items.length,
      continue: cont,
      resourceVersion: meta.resourceVersion,
    })

    if (captureRV) lastRV = meta.resourceVersion
    return {
      items,
      continue: cont,
      remainingItemCount: meta.remainingItemCount as number | undefined,
      resourceVersion: meta.resourceVersion as string | undefined,
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
          error,
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
          error,
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

      const sp = new URLSearchParams()
      sp.set('watch', '1')
      sp.set('allowWatchBookmarks', 'true')
      if (fieldSelector) sp.set('fieldSelector', fieldSelector)
      if (labelSelector) sp.set('labelSelector', labelSelector)
      if (lastRV) sp.set('resourceVersion', lastRV)

      const qs = sp.toString()
      console.log(`[${new Date().toISOString()}]: Watch query:`, qs)

      const controller = new AbortController()
      const filteredHeaders = filterHeadersFromEnv(req)

      const response = await userKubeApi.get(`${watchPath}?${qs}`, {
        headers: {
          ...(DEVELOPMENT ? {} : filteredHeaders),
          'Content-Type': 'application/json',
        },
        responseType: 'stream',
        timeout: 0,
        signal: controller.signal,
      })

      console.log(`[${new Date().toISOString()}]: Watch stream established`)

      const stream = response.data as NodeJS.ReadableStream
      let buffer = ''

      const onStreamData = (chunk: Buffer | string) => {
        buffer += chunk.toString()
        let idx = buffer.indexOf('\n')
        while (idx >= 0) {
          const line = buffer.slice(0, idx).trim()
          buffer = buffer.slice(idx + 1)
          idx = buffer.indexOf('\n')
          if (!line) continue

          try {
            const evt = JSON.parse(line)
            const phase = evt?.type as string | undefined
            const obj = evt?.object

            if (phase === 'ERROR') {
              void onError(obj ?? evt)
              continue
            }
            if (phase) onEvent(phase, obj)
          } catch (error) {
            console.warn(`[${new Date().toISOString()}]: Failed to parse watch event line`, {
              message: error instanceof Error ? error.message : String(error),
              line,
            })
          }
        }
      }

      const onStreamError = (error: unknown) => {
        console.error(`[${new Date().toISOString()}]: Watch stream error:`, error)
        void onError(error)
      }

      const onStreamEnd = () => {
        console.warn(`[${new Date().toISOString()}]: Watch stream ended`)
        void onError(new Error('watch stream ended'))
      }

      stream.on('data', onStreamData)
      stream.on('error', onStreamError)
      stream.on('end', onStreamEnd)
      stream.on('close', onStreamEnd)

      abortCurrentWatch = () => {
        console.log(`[${new Date().toISOString()}]: Aborting watch...`)
        try {
          controller.abort()
        } catch {
          console.warn(`[${new Date().toISOString()}]: Abort failed`)
        }
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}]: Error starting watch:`, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        error,
      })

      if (!closed && isGone410(error)) {
        console.warn(`[${new Date().toISOString()}]: Re-listing after 410 on watch start`)
        try {
          await listPage({ limit: initialLimit, _continue: undefined, captureRV: true })
        } catch (e) {
          console.error(`[${new Date().toISOString()}]: Failed re-list after 410:`, e)
        }
      }

      setTimeout(() => void startWatch(), 2000)
    } finally {
      startingWatch = false
    }
  }

  // -------- INITIAL LIST --------
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
          error,
        })
      }
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}]: Initial list failed:`, {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error,
    })
    sentInitial = true
  }

  // -------- START WATCH + ROTATE --------
  void startWatch()
  const rotateIv = setInterval(
    () => {
      console.log(`[${new Date().toISOString()}]: Periodic watch rotation triggered`)
      void startWatch()
    },
    10 * 60 * 1000,
  )

  // -------- CLIENT MESSAGES (pagination) --------
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
          error,
        })
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'PAGE_ERROR', error: 'Failed to load next page' }))
        }
      }
    }
  })

  // -------- HEARTBEAT --------
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
        error,
      })
    }
  }, 25_000)

  // -------- CLEANUP --------
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
        error,
      })
    }
  })
}
