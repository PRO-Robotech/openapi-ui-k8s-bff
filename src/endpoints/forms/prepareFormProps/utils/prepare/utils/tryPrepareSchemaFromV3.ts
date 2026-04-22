import {
  getOpenApiV3DiscoveryPath,
  getOpenApiV3Document,
  getOpenApiV3Index,
  getOpenApiV3ServerRelativeUrlFromIndex,
} from 'src/cache'
import { OpenAPIV3 } from 'openapi-types'
import { TPrepareSchemaSourceData, TPrepareSchemaSourceResult } from './prepareSchemaSourceResult'
import { checkV3SchemaSupport } from './checkV3SchemaSupport'
import { getBodyParametersSchemaFromV3 } from './getBodyParametersSchemaFromV3'
import { getSwaggerPathAndIsNamespaceScoped } from './getSwaggerPathAndIsNamespaceScoped'
import { normalizeV3SchemaForForms } from './normalizeV3SchemaForForms'

/**
 * Stage 6 makes the v3 source branch fully extractable for forms:
 * discovery/cache comes from the previous step, then we resolve the create
 * path, extract requestBody schema, and run the unsupported-keyword policy.
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

  const swaggerPaths = Object.keys(document.paths || {})
  const { swaggerPath, isNamespaced } = getSwaggerPathAndIsNamespaceScoped({
    swaggerPaths,
    data,
  })
  const swaggerPathValue = document.paths?.[swaggerPath]

  const {
    bodyParametersSchema,
    kind,
    error,
  } = getBodyParametersSchemaFromV3({
    swaggerPathValue: swaggerPathValue as OpenAPIV3.PathItemObject | undefined,
    swaggerPath,
  })

  if (error || !bodyParametersSchema) {
    return {
      source: 'v3',
      status: 'error',
      error: error ?? `No body schema for ${swaggerPath}`,
      isNamespaced,
      kind,
    }
  }

  const normalizedBodyParametersSchema = normalizeV3SchemaForForms(bodyParametersSchema)
  const supportResult = checkV3SchemaSupport(normalizedBodyParametersSchema)

  if (!supportResult.supported) {
    return {
      source: 'v3',
      status: 'unsupported',
      error: `Unsupported OpenAPI v3 schema for auto-generated form: ${swaggerPath}`,
      issues: supportResult.issues,
      isNamespaced,
      kind,
    }
  }

  return {
    source: 'v3',
    status: 'success',
    bodyParametersSchema: normalizedBodyParametersSchema,
    isNamespaced,
    kind,
  }
}
