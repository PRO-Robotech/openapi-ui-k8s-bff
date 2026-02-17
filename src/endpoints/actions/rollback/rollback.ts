import { Request, RequestHandler, Response } from 'express'
import { userKubeApi } from 'src/constants/httpAgent'
import { DEVELOPMENT } from 'src/constants/envs'
import { filterHeadersFromEnv } from 'src/utils/filterHeadersFromEnv'

type TRollbackRequest = {
  body: {
    resourceEndpoint: string
    resourceName: string
  }
}

type TReplicaSet = {
  metadata: {
    name: string
    annotations?: Record<string, string>
    ownerReferences?: Array<{
      uid: string
      kind: string
      name: string
    }>
  }
  spec: {
    template: Record<string, unknown>
  }
}

export const rollback: RequestHandler = async (req: TRollbackRequest & Request, res: Response) => {
  const { resourceEndpoint, resourceName } = req.body

  if (!resourceEndpoint || !resourceName) {
    return res.status(400).json({ error: '`resourceEndpoint` and `resourceName` are required' })
  }

  const filteredHeaders = filterHeadersFromEnv(req)
  const jsonHeaders = {
    ...(DEVELOPMENT ? {} : filteredHeaders),
    'Content-Type': 'application/json',
  }
  const patchHeaders = {
    ...(DEVELOPMENT ? {} : filteredHeaders),
    'Content-Type': 'application/json-patch+json',
  }

  try {
    // Step 1: Get the Deployment
    const { data: deployment } = await userKubeApi.get(resourceEndpoint, {
      headers: jsonHeaders,
    })

    const currentRevision = parseInt(deployment.metadata?.annotations?.['deployment.kubernetes.io/revision'] || '0', 10)

    if (currentRevision <= 1) {
      return res.status(400).json({ error: 'No previous revision available to rollback to' })
    }

    // Step 2: Build the label selector from the Deployment's matchLabels
    const matchLabels: Record<string, string> = deployment.spec?.selector?.matchLabels || {}
    const labelSelector = Object.entries(matchLabels)
      .map(([k, v]) => `${k}=${v}`)
      .join(',')

    if (!labelSelector) {
      return res.status(400).json({ error: 'Deployment has no matchLabels in selector' })
    }

    // Step 3: List ReplicaSets in the same namespace
    const namespace = deployment.metadata?.namespace
    const apiVersion = deployment.apiVersion || 'apps/v1'
    const apiBase = apiVersion.includes('/') ? `/apis/${apiVersion}` : `/api/${apiVersion}`
    const rsListPath = namespace
      ? `${apiBase}/namespaces/${namespace}/replicasets?labelSelector=${encodeURIComponent(labelSelector)}`
      : `${apiBase}/replicasets?labelSelector=${encodeURIComponent(labelSelector)}`

    const { data: rsList } = await userKubeApi.get<{ items: TReplicaSet[] }>(rsListPath, {
      headers: jsonHeaders,
    })

    // Step 4: Filter RSes by ownerReference to this Deployment
    const deploymentUid = deployment.metadata?.uid
    const ownedRSes =
      rsList.items?.filter(
        rs => rs.metadata.ownerReferences?.some(ref => ref.uid === deploymentUid && ref.kind === 'Deployment'),
      ) || []

    // Step 5: Find the RS with the highest revision below current (handles gaps)
    const revisionsDescending = ownedRSes
      .map(rs => ({
        rs,
        revision: parseInt(rs.metadata.annotations?.['deployment.kubernetes.io/revision'] || '0', 10),
      }))
      .filter(({ revision }) => revision < currentRevision && revision > 0)
      .sort((a, b) => b.revision - a.revision)

    const previous = revisionsDescending[0]

    if (!previous) {
      return res.status(400).json({ error: 'No previous ReplicaSet revision found to rollback to' })
    }

    // Step 6: Patch the Deployment using JSON Patch (matches kubectl rollout undo)
    await userKubeApi.patch(
      resourceEndpoint,
      [
        {
          op: 'replace',
          path: '/spec/template',
          value: previous.rs.spec.template,
        },
        {
          op: 'replace',
          path: '/metadata/annotations',
          value: deployment.metadata?.annotations || {},
        },
      ],
      { headers: patchHeaders },
    )

    return res.json({
      rolledBack: true,
      fromRevision: currentRevision,
      toRevision: previous.revision,
    })
  } catch (error) {
    console.error('[rollback] Error:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      resourceName,
    })

    const errorResponse = {
      error: error instanceof Error ? error.message : String(error),
      ...(DEVELOPMENT && error instanceof Error ? { stack: error.stack } : {}),
    }
    return res.status(500).json(errorResponse)
  }
}
