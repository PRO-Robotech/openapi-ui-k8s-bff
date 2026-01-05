import { RequestHandler } from 'express'

type TPluginConfig = {
  name: string
  entry: string
  exposedModule: string
}

type TPluginMap = Record<string, TPluginConfig>

const isPluginConfig = (x: unknown): x is TPluginConfig => {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return typeof o.name === 'string' && typeof o.entry === 'string' && typeof o.exposedModule === 'string'
}

const getPluginsFromEnv = (): TPluginMap => {
  const raw = process.env.MF_PLUGINS_JSON
  if (!raw) return {}

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }

  if (!parsed || typeof parsed !== 'object') return {}

  const out: TPluginMap = {}
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!isPluginConfig(value)) continue
    out[key] = value
  }

  return out
}

export const getPlugins: RequestHandler = async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store')
    res.json(getPluginsFromEnv())
  } catch (error) {
    console.error('Error getting kinds:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error: error,
      body: req.body,
    })
    const errorResponse = {
      error: error instanceof Error ? error.message : String(error),
      ...(process.env.DEVELOPMENT === 'TRUE' && error instanceof Error ? { stack: error.stack } : {}),
    }
    res.status(500).json(errorResponse)
  }
}
