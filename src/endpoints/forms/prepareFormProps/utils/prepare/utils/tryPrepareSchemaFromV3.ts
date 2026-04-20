import {
  getOpenApiV3DiscoveryPath,
  getOpenApiV3Document,
  getOpenApiV3Index,
  getOpenApiV3ServerRelativeUrlFromIndex,
} from 'src/cache'
import { TPrepareSchemaSourceData, TPrepareSchemaSourceResult } from './prepareSchemaSourceResult'

/**
 * Stage 5 wires the v3 source branch into discovery/cache.
 * Schema extraction from the fetched v3 document is intentionally deferred to
 * the next step so we can keep the migration incremental.
 */
export const tryPrepareSchemaFromV3 = async ({
  data,
}: {
  data: TPrepareSchemaSourceData
}): Promise<TPrepareSchemaSourceResult> => {
  const discoveryIndex = await getOpenApiV3Index()

  if (!discoveryIndex) {
    return {
      source: 'v3',
      status: 'unavailable',
      error: 'OpenAPI v3 discovery index is unavailable',
    }
  }

  const discoveryPath = getOpenApiV3DiscoveryPath(data)
  const serverRelativeURL = getOpenApiV3ServerRelativeUrlFromIndex({
    discoveryIndex,
    discoveryPath,
  })

  if (!serverRelativeURL) {
    return {
      source: 'v3',
      status: 'unavailable',
      error: `OpenAPI v3 discovery entry not found for ${discoveryPath}`,
    }
  }

  const document = await getOpenApiV3Document(serverRelativeURL)

  if (!document) {
    return {
      source: 'v3',
      status: 'error',
      error: `Failed to load OpenAPI v3 document for ${discoveryPath}`,
      isNamespaced: false,
      kind: undefined,
    }
  }

  return {
    source: 'v3',
    status: 'error',
    error: `OpenAPI v3 document resolved for ${discoveryPath}, but schema extraction is not implemented yet`,
    isNamespaced: false,
    kind: undefined,
  }
}
