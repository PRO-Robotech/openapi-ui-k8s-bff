import { TEventsV1Event } from './types'

// Add these helpers near the top (e.g., under isGone410)
const toMillis = (t?: unknown): number => {
  if (!t) return 0
  if (t instanceof Date) return t.getTime()
  if (typeof t === 'string') {
    const ms = Date.parse(t)
    return Number.isFinite(ms) ? ms : 0
  }
  return 0
}

export const eventSortKey = (ev: TEventsV1Event): number => {
  // events.k8s.io/v1 prefers eventTime; fall back to series.lastObservedTime, then creationTimestamp
  return Math.max(
    toMillis((ev as any).eventTime),
    toMillis((ev.series as any)?.lastObservedTime),
    toMillis((ev.metadata as any)?.creationTimestamp),
  )
}
