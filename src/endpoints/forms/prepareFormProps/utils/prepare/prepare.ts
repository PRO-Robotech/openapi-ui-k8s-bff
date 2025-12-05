import _ from 'lodash'
import { getClusterSwaggerPathByName, getClusterSwaggerPaths } from 'src/cache'
import { TPrepareForm } from 'src/localTypes/forms'
import { TPrepareFormRes } from 'src/localTypes/endpoints/forms'
import { deepMerge } from 'src/utils/deepMerge'
import {
  getSwaggerPathAndIsNamespaceScoped,
  getBodyParametersSchema,
  processOverrideSchema,
  getPathsWithAdditionalProperties,
  getPropertiesToMerge,
  computePersistedAPPaths,
  getPathsFromOverride,
} from './utils'

export const prepare = async ({
  data,
  formsOverridesData,
  formsPrefillsData,
  customizationId,
  namespacesData,
}: TPrepareForm): Promise<TPrepareFormRes> => {
  const swaggerPaths = await getClusterSwaggerPaths()

  if (!swaggerPaths) {
    return {
      result: 'error',
      error: 'no swagger paths',
      isNamespaced: false,
      kind: undefined,
      fallbackToManualMode: true,
    }
  }

  const { swaggerPath, isNamespaced } = getSwaggerPathAndIsNamespaceScoped({
    swaggerPaths,
    data,
  })

  const swaggerPathValue = await getClusterSwaggerPathByName(swaggerPath)

  const { bodyParametersSchema, kind, error } = getBodyParametersSchema({ swaggerPathValue, swaggerPath })

  if (error) {
    return { result: 'error', error, isNamespaced, kind, fallbackToManualMode: true }
  }

  const specificCustomOverrides = formsOverridesData?.items.find(item => item.spec.customizationId === customizationId)

  const { propertiesToApply: mergedProperties, requiredToApply: mergedRequired } = processOverrideSchema({
    specificCustomOverrides,
    newProperties: _.cloneDeep(bodyParametersSchema.properties),
    bodyParametersSchema,
  })

  const pathsWithAdditionalProperties: (string | number)[][] = getPathsWithAdditionalProperties({
    properties: bodyParametersSchema.properties,
  })

  const propertiesToMerge = getPropertiesToMerge({
    pathsWithAdditionalProperties,
    prefillValuesSchema: data.prefillValuesSchema,
    mergedProperties,
  })

  const oldProperties = _.cloneDeep(mergedProperties)
  const newProperties = deepMerge(oldProperties, propertiesToMerge)

  const autoPersistedFromAP = computePersistedAPPaths({
    pathsWithAdditionalProperties,
    prefillValuesSchema: data.prefillValuesSchema,
  })

  const { hiddenPaths, expandedPaths, persistedPaths, sortPaths } = getPathsFromOverride({
    specificCustomOverrides,
  })

  // merge persisted lists generically
  const mergedPersistedPaths: string[][] = [...(persistedPaths || []), ...autoPersistedFromAP]

  // ensure uniqueness (optional)
  const uniqPersisted = Array.from(new Map(mergedPersistedPaths.map(p => [p.join('\u0000'), p])).values())

  // merge persisted lists generically
  const mergedExpandedPaths: string[][] = [...(expandedPaths || []), ...autoPersistedFromAP]

  // ensure uniqueness (optional)
  const uniqExpanded = Array.from(new Map(mergedExpandedPaths.map(p => [p.join('\u0000'), p])).values())

  return {
    result: 'success',
    properties: newProperties,
    required: mergedRequired,
    hiddenPaths: hiddenPaths || [],
    expandedPaths: uniqExpanded,
    persistedPaths: uniqPersisted,
    sortPaths,
    kind,
    isNamespaced,
    formPrefills: formsPrefillsData?.items.find(item => item.spec.customizationId === customizationId),
    namespacesData: namespacesData?.items?.map(item => item.metadata?.name).filter(Boolean),
  }
}
