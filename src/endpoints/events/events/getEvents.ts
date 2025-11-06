import { RequestHandler } from 'express'
import { createUserKubeClient } from 'src/constants/kubeClients'
import { filterHeadersFromEnv } from 'src/utils/filterHeadersFromEnv'

export const getEvents: RequestHandler = async (req, res) => {
  try {
    const filteredHeaders = filterHeadersFromEnv(req)

    const userKubeClient = createUserKubeClient(filteredHeaders)

    const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 50))
    const continueToken = (req.query.continue as string) || undefined
    const ns = (req.query.namespace as string) || undefined

    // Build the shared params object (note: "continue" is a reserved word, so quote it)
    const baseParams: Record<string, any> = {
      limit,
      ...(continueToken ? { ['continue']: continueToken } : {}),
      // fieldSelector: "...",
      // labelSelector: "...",
      // resourceVersion: "...",
      // resourceVersionMatch: "...",
      // timeoutSeconds: 30,
      // watch: false,
    }

    const list = ns
      ? await userKubeClient.events.listNamespacedEvent({
          namespace: ns,
          ...baseParams,
        })
      : await userKubeClient.events.listEventForAllNamespaces(baseParams)

    // list is an EventsV1EventList (no `.body`)
    const items = (list.items || []).sort((a: any, b: any) => {
      const at =
        (a.eventTime && Date.parse(a.eventTime as any)) ||
        (a.lastTimestamp && Date.parse(a.lastTimestamp as any)) ||
        (a.metadata?.creationTimestamp ? Date.parse(a.metadata.creationTimestamp as any) : 0)
      const bt =
        (b.eventTime && Date.parse(b.eventTime as any)) ||
        (b.lastTimestamp && Date.parse(b.lastTimestamp as any)) ||
        (b.metadata?.creationTimestamp ? Date.parse(b.metadata.creationTimestamp as any) : 0)
      return bt - at
    })

    res.json({
      items,
      continue: list.metadata?._continue ?? null,
    })
  } catch (error: any) {
    console.error(
      'Error listing events:',
      error?.response?.data || {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          error: error,
          body: req.body,
        } ||
        error,
    )
    res.status(500).json({
      error:
        error?.response?.data?.message ||
        error?.message || {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          error: error,
          body: req.body,
        } ||
        'Failed to list events',
    })
  }
}
