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
    'Content-Type': 'application/strategic-merge-patch+json',
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

    // Step 4: Find the RS with the previous revision
    const targetRevision = currentRevision - 1
    const previousRS = rsList.items?.find(rs => {
      const rsRevision = parseInt(rs.metadata.annotations?.['deployment.kubernetes.io/revision'] || '0', 10)
      return rsRevision === targetRevision
    })

    if (!previousRS) {
      return res.status(400).json({ error: `No ReplicaSet found with revision ${targetRevision}` })
    }

    // Step 5: Patch the Deployment's spec.template with the previous RS's template
    await userKubeApi.patch(
      resourceEndpoint,
      { spec: { template: previousRS.spec.template } },
      { headers: patchHeaders },
    )

    return res.json({
      rolledBack: true,
      fromRevision: currentRevision,
      toRevision: targetRevision,
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
