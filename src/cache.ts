import NodeCache from 'node-cache'
import { dereference } from '@readme/openapi-parser'
import { OpenAPIV2, OpenAPIV3 } from 'openapi-types'
import { kubeApi } from 'src/constants/httpAgent'
import { TPrepareForm } from 'src/localTypes/forms'

const DEFAULT_TTL = 60 * 15
const NEGATIVE_TTL = DEFAULT_TTL
// const KEYS_AND_PATHS_TTL = 60 * 16
const CHECK_PERIOD = 60 * 14
// IMPORTANT: no TTL for derived keys (0 = never expire)
const DERIVED_TTL = 0
const OPENAPI_V3_INDEX_CACHE_KEY = 'openApiV3Index'
const OPENAPI_V3_INDEX_NEGATIVE_CACHE_KEY = 'openApiV3Index:negative'
const OPENAPI_V3_DOCUMENT_CACHE_KEY_PREFIX = 'openApiV3Document:'
const OPENAPI_V3_DOCUMENT_NEGATIVE_CACHE_KEY_PREFIX = 'openApiV3Document:negative:'
const SWAGGER_NEGATIVE_CACHE_KEY = 'swagger:negative'

console.log(`[${new Date().toISOString()}]: cache module loaded`)

export const cache = new NodeCache({ stdTTL: DEFAULT_TTL, checkperiod: CHECK_PERIOD })

/** single-flight guard to prevent duplicate fetches */
let inflightV2Swagger: Promise<OpenAPIV2.Document | undefined> | null = null
let inflightV3Index: Promise<TOpenApiV3DiscoveryIndex | undefined> | null = null
const inflightV3Documents = new Map<string, Promise<OpenAPIV3.Document | undefined>>()

export type TOpenApiV3DiscoveryEntry = {
  serverRelativeURL: string
}

export type TOpenApiV3DiscoveryIndex = {
  paths?: Record<string, TOpenApiV3DiscoveryEntry>
}

const hasNegativeCacheEntry = (key: string): boolean => cache.get<boolean>(key) === true

const setNegativeCacheEntry = (key: string): void => {
  cache.set(key, true, NEGATIVE_TTL)
}

const clearNegativeCacheEntry = (key: string): void => {
  cache.del(key)
}

const getOpenApiV3DocumentCacheKey = (serverRelativeURL: string): string =>
  `${OPENAPI_V3_DOCUMENT_CACHE_KEY_PREFIX}${serverRelativeURL}`

const getOpenApiV3DocumentNegativeCacheKey = (serverRelativeURL: string): string =>
  `${OPENAPI_V3_DOCUMENT_NEGATIVE_CACHE_KEY_PREFIX}${serverRelativeURL}`

async function fetchSwaggerOnce(): Promise<OpenAPIV2.Document | undefined> {
  if (hasNegativeCacheEntry(SWAGGER_NEGATIVE_CACHE_KEY)) {
    console.log(`[${new Date().toISOString()}]: Cache get: ${SWAGGER_NEGATIVE_CACHE_KEY}`)
    return undefined
  }

  if (inflightV2Swagger) return inflightV2Swagger
  inflightV2Swagger = (async () => {
    try {
      const { data: rawSpec } = await kubeApi.get<OpenAPIV2.Document>(`/openapi/v2`)
      const derefedSpec = (await dereference(rawSpec, { dereference: { circular: 'ignore' } })) as OpenAPIV2.Document
      clearNegativeCacheEntry(SWAGGER_NEGATIVE_CACHE_KEY)
      return derefedSpec
    } catch (error) {
      setNegativeCacheEntry(SWAGGER_NEGATIVE_CACHE_KEY)
      console.error('Error fetching swagger:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        error,
      })
      return undefined
    } finally {
      // allow new fetch after this one resolves
      inflightV2Swagger = null
    }
  })()
  return inflightV2Swagger
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

async function fetchOpenApiV3IndexOnce(): Promise<TOpenApiV3DiscoveryIndex | undefined> {
  if (inflightV3Index) return inflightV3Index

  inflightV3Index = (async () => {
    try {
      const { data } = await kubeApi.get<TOpenApiV3DiscoveryIndex>('/openapi/v3')
      return data
    } catch (error) {
      console.error('Error fetching OpenAPI v3 discovery index:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        error,
      })
      return undefined
    } finally {
      inflightV3Index = null
    }
  })()

  return inflightV3Index
}

async function fetchOpenApiV3DocumentOnce(serverRelativeURL: string): Promise<OpenAPIV3.Document | undefined> {
  const existingInflight = inflightV3Documents.get(serverRelativeURL)

  if (existingInflight) return existingInflight

  const inflightDocument = (async () => {
    try {
      const { data: rawSpec } = await kubeApi.get<OpenAPIV3.Document>(serverRelativeURL)
      const derefedSpec = (await dereference(rawSpec, { dereference: { circular: 'ignore' } })) as OpenAPIV3.Document
      return derefedSpec
    } catch (error) {
      console.error('Error fetching OpenAPI v3 document:', {
        serverRelativeURL,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        error,
      })
      return undefined
    } finally {
      inflightV3Documents.delete(serverRelativeURL)
    }
  })()

  inflightV3Documents.set(serverRelativeURL, inflightDocument)
  return inflightDocument
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

export const getOpenApiV3DiscoveryPath = (data: TPrepareForm['data']): string => {
  if (data.type === 'builtin') {
    return 'api/v1'
  }

  return `apis/${data.apiGroup}/${data.apiVersion}`
}

export const getOpenApiV3ServerRelativeUrlFromIndex = ({
  discoveryIndex,
  discoveryPath,
}: {
  discoveryIndex: TOpenApiV3DiscoveryIndex
  discoveryPath: string
}): string | undefined => discoveryIndex.paths?.[discoveryPath]?.serverRelativeURL

export async function getOpenApiV3Index(): Promise<TOpenApiV3DiscoveryIndex | undefined> {
  let discoveryIndex = cache.get<TOpenApiV3DiscoveryIndex>(OPENAPI_V3_INDEX_CACHE_KEY)

  if (discoveryIndex) {
    console.log(`[${new Date().toISOString()}]: Cache get: ${OPENAPI_V3_INDEX_CACHE_KEY}`)
    return discoveryIndex
  }

  if (hasNegativeCacheEntry(OPENAPI_V3_INDEX_NEGATIVE_CACHE_KEY)) {
    console.log(`[${new Date().toISOString()}]: Cache get: ${OPENAPI_V3_INDEX_NEGATIVE_CACHE_KEY}`)
    return undefined
  }

  discoveryIndex = await fetchOpenApiV3IndexOnce()

  if (!discoveryIndex) {
    setNegativeCacheEntry(OPENAPI_V3_INDEX_NEGATIVE_CACHE_KEY)
    return undefined
  }

  clearNegativeCacheEntry(OPENAPI_V3_INDEX_NEGATIVE_CACHE_KEY)
  cache.set(OPENAPI_V3_INDEX_CACHE_KEY, discoveryIndex)

  console.log(`[${new Date().toISOString()}]: Cache populated: ${OPENAPI_V3_INDEX_CACHE_KEY}`)
  return discoveryIndex
}

export async function getOpenApiV3Document(serverRelativeURL: string): Promise<OpenAPIV3.Document | undefined> {
  const cacheKey = getOpenApiV3DocumentCacheKey(serverRelativeURL)
  const negativeCacheKey = getOpenApiV3DocumentNegativeCacheKey(serverRelativeURL)

  let document = cache.get<OpenAPIV3.Document>(cacheKey)

  if (document) {
    console.log(`[${new Date().toISOString()}]: Cache get: ${cacheKey}`)
    return document
  }

  if (hasNegativeCacheEntry(negativeCacheKey)) {
    console.log(`[${new Date().toISOString()}]: Cache get: ${negativeCacheKey}`)
    return undefined
  }

  document = await fetchOpenApiV3DocumentOnce(serverRelativeURL)

  if (!document) {
    setNegativeCacheEntry(negativeCacheKey)
    return undefined
  }

  clearNegativeCacheEntry(negativeCacheKey)
  cache.set(cacheKey, document, DERIVED_TTL)

  console.log(`[${new Date().toISOString()}]: Cache populated: ${cacheKey}`)
  return document
}

cache.on('expired', (key: string) => {
  console.log(`[${new Date().toISOString()}]: Cache key "${key}" expired, reloading…`)
  if (key === 'swagger') {
    populateAllFromSwagger().catch(err => {
      console.error(`[${new Date().toISOString()}]: Failed to reload cache for "${key}" on expire:`, err)
    })
  } else if (key === OPENAPI_V3_INDEX_CACHE_KEY) {
    getOpenApiV3Index().catch(err => {
      console.error(`[${new Date().toISOString()}]: Failed to reload cache for "${key}" on expire:`, err)
    })
  } else {
    console.log(`[${new Date().toISOString()}]: No expire func for key: "${key}"`)
  }
})
