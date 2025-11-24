import { Request } from 'express'
import { BASE_ALLOWED_AUTH_HEADERS } from 'src/constants/envs'

export const filterHeadersFromEnv = (req: Request): Record<string, string | string[] | undefined> => {
  const allowedHeaders = BASE_ALLOWED_AUTH_HEADERS.split(',')
    .map(h => h.trim().toLowerCase())
    .filter(Boolean) // remove empty strings

  const allowedSet = new Set(allowedHeaders)
  const filtered: Record<string, string | string[] | undefined> = {}

  for (const [key, value] of Object.entries(req.headers)) {
    if (allowedSet.has(key.toLowerCase())) {
      filtered[key] = value
    }
  }

  return filtered
}
