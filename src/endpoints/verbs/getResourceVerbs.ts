import { RequestHandler, Request, Response } from 'express'
import { kubeApi } from 'src/constants/httpAgent'

/**
 * Query params:
 *   group: optional, e.g. "apps" or empty for core
 *   version: required, e.g. "v1"
 *   resource: required, plural resource name like "deployments" or "pods"
 *
 * Examples:
 *   /api/k8s/verbs?group=apps&version=v1&resource=deployments
 *   /api/k8s/verbs?version=v1&resource=pods
 */
export const getResourceVerbs: RequestHandler = async (req: Request, res: Response) => {
  const { group, version, resource } = req.query as {
    group?: string
    version?: string
    resource?: string
  }

  if (!version || !resource) {
    return res.status(400).json({ error: '`version` and `resource` are required' })
  }

  try {
    // Construct API path
    const basePath = group && group !== 'core' ? `/apis/${group}/${version}` : `/api/${version}`

    // Get the resource list from the discovery API
    const { data } = await kubeApi.get(`${basePath}`)

    const target = data.resources?.find((r: any) => r.name === resource || r.name === `${resource}/${r.singularName}`)

    if (!target) {
      return res.status(404).json({ error: `Resource "${resource}" not found in ${basePath}` })
    }

    const { verbs, namespaced, kind, categories } = target

    return res.json({
      kind,
      namespaced,
      categories,
      verbs,
    })
  } catch (err: any) {
    return res.status(500).json({
      error: 'Failed to fetch resource verbs',
      details: err?.response?.data || err.message,
    })
  }
}
