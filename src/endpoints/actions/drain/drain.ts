import { Request, RequestHandler, Response } from 'express'
import { userKubeApi } from 'src/constants/httpAgent'
import { DEVELOPMENT } from 'src/constants/envs'
import { filterHeadersFromEnv } from 'src/utils/filterHeadersFromEnv'

type TDrainRequest = {
  body: {
    nodeName: string
    apiPath: string
    ignoreDaemonSets?: boolean
    gracePeriodSeconds?: number
  }
}

type TPodItem = {
  metadata: {
    name: string
    namespace: string
    annotations?: Record<string, string>
    ownerReferences?: { kind: string }[]
  }
  status?: {
    phase?: string
  }
}

export const drain: RequestHandler = async (req: TDrainRequest & Request, res: Response) => {
  const { nodeName, apiPath, ignoreDaemonSets = true, gracePeriodSeconds } = req.body

  if (!nodeName || !apiPath) {
    return res.status(400).json({ error: '`nodeName` and `apiPath` are required' })
  }

  const filteredHeaders = filterHeadersFromEnv(req)
  const headers = {
    ...(DEVELOPMENT ? {} : filteredHeaders),
    'Content-Type': 'application/strategic-merge-patch+json',
  }
  const jsonHeaders = {
    ...(DEVELOPMENT ? {} : filteredHeaders),
    'Content-Type': 'application/json',
  }

  try {
    // Step 1: Cordon the node (mark unschedulable)
    await userKubeApi.patch(apiPath, { spec: { unschedulable: true } }, { headers })

    // Step 2: List pods on the node
    const { data: podList } = await userKubeApi.get<{ items: TPodItem[] }>(
      `/api/v1/pods?fieldSelector=spec.nodeName=${encodeURIComponent(nodeName)}`,
      { headers: jsonHeaders },
    )

    const pods: TPodItem[] = podList.items || []

    // Step 3: Filter out ineligible pods
    const eligiblePods = pods.filter(pod => {
      // Skip already-terminated pods
      if (pod.status?.phase === 'Succeeded' || pod.status?.phase === 'Failed') {
        return false
      }
      // Skip mirror pods
      if (pod.metadata.annotations?.['kubernetes.io/config.mirror']) {
        return false
      }
      // Skip DaemonSet-managed pods if requested
      if (ignoreDaemonSets) {
        const isDaemonSetPod = pod.metadata.ownerReferences?.some(ref => ref.kind === 'DaemonSet')
        if (isDaemonSetPod) {
          return false
        }
      }
      return true
    })

    const skipped = pods.length - eligiblePods.length

    // Step 4: Evict each eligible pod
    const results = await Promise.allSettled(
      eligiblePods.map(pod => {
        const evictionBody: Record<string, unknown> = {
          apiVersion: 'policy/v1',
          kind: 'Eviction',
          metadata: {
            name: pod.metadata.name,
            namespace: pod.metadata.namespace,
          },
        }
        if (gracePeriodSeconds !== undefined) {
          evictionBody.deleteOptions = { gracePeriodSeconds }
        }

        return userKubeApi.post(
          `/api/v1/namespaces/${pod.metadata.namespace}/pods/${pod.metadata.name}/eviction`,
          evictionBody,
          { headers: jsonHeaders },
        )
      }),
    )

    const failed: { name: string; namespace: string; error: string }[] = []
    let drained = 0

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        drained += 1
      } else {
        const pod = eligiblePods[index]
        const reason = result.reason instanceof Error ? result.reason.message : String(result.reason)
        failed.push({
          name: pod.metadata.name,
          namespace: pod.metadata.namespace,
          error: reason,
        })
      }
    })

    return res.json({ drained, failed, skipped })
  } catch (error) {
    console.error('[drain] Error:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      nodeName,
    })

    const errorResponse = {
      error: error instanceof Error ? error.message : String(error),
      ...(DEVELOPMENT && error instanceof Error ? { stack: error.stack } : {}),
    }
    return res.status(500).json(errorResponse)
  }
}
