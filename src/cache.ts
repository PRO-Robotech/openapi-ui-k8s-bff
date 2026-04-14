import NodeCache from 'node-cache'
import { dereference } from '@readme/openapi-parser'
import { OpenAPIV2 } from 'openapi-types'
import { kubeApi } from 'src/constants/httpAgent'

const DEFAULT_TTL = 60 * 15
// const KEYS_AND_PATHS_TTL = 60 * 16
const CHECK_PERIOD = 60 * 14
// IMPORTANT: no TTL for derived keys (0 = never expire)
const DERIVED_TTL = 0

console.log(`[${new Date().toISOString()}]: cache module loaded`)

export const cache = new NodeCache({ stdTTL: DEFAULT_TTL, checkperiod: CHECK_PERIOD })

/** single-flight guard to prevent duplicate fetches */
let inflight: Promise<OpenAPIV2.Document | undefined> | null = null

async function fetchSwaggerOnce(): Promise<OpenAPIV2.Document | undefined> {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const { data: rawSpec } = await kubeApi.get<OpenAPIV2.Document>(`/openapi/v2`)
      const derefedSpec = (await dereference(rawSpec, { dereference: { circular: 'ignore' } })) as OpenAPIV2.Document
      return derefedSpec
    } catch (error) {
      console.error('Error fetching swagger:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        error,
      })
      return undefined
    } finally {
      // allow new fetch after this one resolves
      inflight = null
    }
  })()
  return inflight
}

/** populate cache: swagger (TTL) + derived keys (no TTL) */
async function populateAllFromSwagger(spec?: OpenAPIV2.Document): Promise<OpenAPIV2.Document | undefined> {
  const swagger = spec ?? (await fetchSwaggerOnce())
  if (!swagger) return undefined

  // Set swagger with TTL (uses cache stdTTL)
  cache.set('swagger', swagger)

  // Derived keys: no TTL so they never "expire" independently
  const paths = Object.keys(swagger.paths || {})
  cache.set('swaggerPaths', paths, DERIVED_TTL)

  paths.forEach(p => {
    cache.set(p, swagger.paths![p], DERIVED_TTL)
  })

  console.log(
    `[${new Date().toISOString()}]: Cache populated: swagger (ttl), swaggerPaths & ${paths.length} paths (no ttl)`,
  )
  return swagger
}

/** Public getters */
export async function getClusterSwagger(): Promise<OpenAPIV2.Document | undefined> {
  let swagger = cache.get<OpenAPIV2.Document>('swagger')

  if (!swagger) {
    swagger = await populateAllFromSwagger()
  }

  console.log(`[${new Date().toISOString()}]: Cache get: swagger`)
  return swagger
}

export async function getClusterSwaggerPaths(): Promise<string[] | undefined> {
  let swaggerPaths = cache.get<string[]>('swaggerPaths')

  if (!swaggerPaths) {
    await populateAllFromSwagger()
  }
  swaggerPaths = cache.get<string[]>('swaggerPaths')

  console.log(`[${new Date().toISOString()}]: Cache get: swaggerPaths`)
  return swaggerPaths
}

export async function getClusterSwaggerPathByName(name: string): Promise<OpenAPIV2.PathItemObject | undefined> {
  let swaggerPathValue = cache.get<OpenAPIV2.PathItemObject>(name)

  if (!swaggerPathValue) {
    await populateAllFromSwagger()
  }
  swaggerPathValue = cache.get<OpenAPIV2.PathItemObject>(name)

  return swaggerPathValue
}

/**
 * Fetch OpenAPI v3 spec for a specific API group/version.
 * K8s serves v3 specs per group at /openapi/v3/apis/{group}/{version}
 * (or /openapi/v3/api/v1 for core resources).
 * Unlike v2, the v3 spec preserves CRD `default` values.
 *
 * Results are cached with the same TTL as the main swagger spec.
 * Graceful degradation: returns undefined if v3 endpoint is unavailable
 * (K8s < 1.27 or network error).
 */
export async function getV3SchemaForGroup(
  type: 'builtin' | 'apis',
  apiGroup?: string,
  apiVersion?: string,
): Promise<Record<string, unknown> | undefined> {
  const v3Path = type === 'builtin' ? '/openapi/v3/api/v1' : `/openapi/v3/apis/${apiGroup}/${apiVersion}`
  const cacheKey = `v3:${v3Path}`

  if (cache.has(cacheKey)) {
    return cache.get<Record<string, unknown>>(cacheKey) ?? undefined
  }

  try {
    const { data } = await kubeApi.get<Record<string, unknown>>(v3Path, {
      headers: { Accept: 'application/json' },
      timeout: 10_000,
    })

    // dereference() accepts any JSON object at runtime (it's a generic $ref resolver),
    // but its type signature expects APIDocument. The cast is safe — K8s v3 responses
    // are valid OpenAPI 3.x documents; same pattern as v2 on line 24.
    const derefed = (await dereference(data as never, { dereference: { circular: 'ignore' } })) as Record<string, unknown>
    cache.set(cacheKey, derefed, DEFAULT_TTL)
    console.log(`[${new Date().toISOString()}]: v3 spec cached for ${v3Path}`)
    return derefed
  } catch (error) {
    cache.set(cacheKey, null, DEFAULT_TTL)
    console.warn(
      `[${new Date().toISOString()}]: v3 spec unavailable for ${v3Path}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
    return undefined
  }
}

cache.on('expired', (key: string) => {
  console.log(`[${new Date().toISOString()}]: Cache key "${key}" expired, reloading…`)
  if (key === 'swagger') {
    populateAllFromSwagger().catch(err => {
      console.error(`[${new Date().toISOString()}]: Failed to reload cache for "${key}" on expire:`, err)
    })
  } else {
    console.log(`[${new Date().toISOString()}]: No expire func for key: "${key}"`)
  }
})
