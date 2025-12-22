export type TWatchPhase = 'ADDED' | 'MODIFIED' | 'DELETED' | 'BOOKMARK'

/** Minimal shape we need from EventsV1Event */
export type TEventsV1Event = {
  metadata?: {
    name?: string
    resourceVersion?: string
    creationTimestamp?: string
  }
  [k: string]: any
}
