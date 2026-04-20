import { getClusterSwaggerPathByName, getClusterSwaggerPaths } from 'src/cache'
import { getBodyParametersSchema } from './getBodyParametersSchema'
import { getSwaggerPathAndIsNamespaceScoped } from './getSwaggerPathAndIsNamespaceScoped'
import { TPrepareSchemaSourceData, TPrepareSchemaSourceResult } from './prepareSchemaSourceResult'

export const tryPrepareSchemaFromV2 = async ({
  data,
}: {
  data: TPrepareSchemaSourceData
}): Promise<TPrepareSchemaSourceResult> => {
  const swaggerPaths = await getClusterSwaggerPaths()

  if (!swaggerPaths) {
    return {
      source: 'v2',
      status: 'unavailable',
      error: 'no swagger paths',
    }
  }

  const { swaggerPath, isNamespaced } = getSwaggerPathAndIsNamespaceScoped({
    swaggerPaths,
    data,
  })

  const swaggerPathValue = await getClusterSwaggerPathByName(swaggerPath)

  if (!swaggerPathValue) {
    return {
      source: 'v2',
      status: 'error',
      error: `No swagger path value for ${swaggerPath}`,
      isNamespaced,
      kind: undefined,
    }
  }

  const { bodyParametersSchema, kind, error } = getBodyParametersSchema({ swaggerPathValue, swaggerPath })

  if (error || !bodyParametersSchema) {
    return {
      source: 'v2',
      status: 'error',
      error: error ?? `No body schema for ${swaggerPath}`,
      isNamespaced,
      kind,
    }
  }

  return {
    source: 'v2',
    status: 'success',
    bodyParametersSchema,
    isNamespaced,
    kind,
  }
}
