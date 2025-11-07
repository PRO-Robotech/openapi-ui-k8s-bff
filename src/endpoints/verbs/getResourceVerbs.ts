import { RequestHandler, Request, Response } from 'express'
import { kubeApi } from 'src/constants/httpAgent'

/**
 * Query params:
 *   group: optional, e.g. "apps" or empty for core
 *   version: required, e.g. "v1"
 *   plural: required, plural resource name like "deployments" or "pods"
 *
 * Examples:
 *   /api/k8s/verbs?group=apps&version=v1&resource=deployments
 *   /api/k8s/verbs?version=v1&resource=pods
 */
export const getResourceVerbs: RequestHandler = async (req: Request, res: Response) => {
  const { group, version, plural } = req.query as {
    group?: string
    version?: string
    plural?: string
  }

  if (!version || !plural) {
    return res.status(400).json({ error: '`version` and `plural` are required' })
  }

  try {
    // Construct API path
    const basePath = group && group !== 'core' ? `/apis/${group}/${version}` : `/api/${version}`

    // Get the resource list from the discovery API
    const { data } = await kubeApi.get(`${basePath}`)

    const target = data.resources?.find((r: any) => r.name === plural || r.name === `${plural}/${r.singularName}`)

    if (!target) {
      return res.status(404).json({ error: `Resource "${plural}" not found in ${basePath}` })
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
