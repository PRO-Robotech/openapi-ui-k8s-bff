import _ from 'lodash'
import { TPrepareForm } from 'src/localTypes/forms'
import { TPrepareFormRes } from 'src/localTypes/endpoints/forms'
import { TPrepareSchemaSourceSuccessResult } from './prepareSchemaSourceResult'
import { deepMerge } from 'src/utils/deepMerge'
import { getPathsWithAdditionalProperties } from './getPathsWithAdditionalProperties'
import { getPropertiesToMerge } from './getPropertiesToMerge'
import { getPathsFromOverride } from './getPathsFromOverride'
import { computePersistedAPPaths } from './computePersistedAPPaths'
import { computePersistedFormPrefillPaths } from './computePersistedFormPrefillPaths'
import { computePersistedPrefillPaths } from './computePersistedPrefillPaths'
import { normalizeFormPrefill } from './normalizeFormPrefill'
import { resolveFormPrefillPartsOfUrl } from './resolveFormPrefillPartsOfUrl'
import { resolvePrefillCustomizationId } from './resolvePrefillCustomizationId'
import { processOverrideSchema } from './processOverride'

type TFinalizePreparedFormArgs = Pick<
  TPrepareForm,
  | 'data'
  | 'formsOverridesData'
  | 'formsPrefillsData'
  | 'customizationId'
  | 'customizationIdPrefill'
  | 'partsOfUrl'
  | 'namespacesData'
> &
  TPrepareSchemaSourceSuccessResult

export const finalizePreparedForm = ({
  data,
  formsOverridesData,
  formsPrefillsData,
  customizationId,
  customizationIdPrefill,
  partsOfUrl,
  namespacesData,
  bodyParametersSchema,
  kind,
  isNamespaced,
}: TFinalizePreparedFormArgs): TPrepareFormRes => {
  const schemaProperties = bodyParametersSchema.properties ?? {}
  const specificCustomOverrides = formsOverridesData?.items.find(item => item.spec.customizationId === customizationId)

  const { propertiesToApply: mergedProperties, requiredToApply: mergedRequired } = processOverrideSchema({
    specificCustomOverrides,
    newProperties: _.cloneDeep(schemaProperties),
    bodyParametersSchema,
  })

  const pathsWithAdditionalProperties: (string | number)[][] = getPathsWithAdditionalProperties({
    properties: schemaProperties,
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
  const autoPersistedFromPrefill = computePersistedPrefillPaths({
    prefillValuesSchema: data.prefillValuesSchema,
  })
  const prefillCustomizationId = resolvePrefillCustomizationId({
    customizationId,
    customizationIdPrefill,
  })
  const selectedPrefill = formsPrefillsData?.items.find(item => item.spec.customizationId === prefillCustomizationId)
  const normalizedPrefill = normalizeFormPrefill(selectedPrefill)
  const resolvedPrefill = resolveFormPrefillPartsOfUrl({ prefill: normalizedPrefill, partsOfUrl })
  const autoPersistedFromSelectedPrefill = computePersistedFormPrefillPaths(resolvedPrefill)

  const { forceViewMode, hiddenPaths, expandedPaths, persistedPaths, sortPaths } = getPathsFromOverride({
    specificCustomOverrides,
  })

  const mergedPersistedPaths: (string | number)[][] = [
    ...(persistedPaths || []),
    ...autoPersistedFromAP,
    ...autoPersistedFromPrefill,
    ...autoPersistedFromSelectedPrefill,
  ]
  const uniqPersisted = Array.from(new Map(mergedPersistedPaths.map(path => [path.join('\u0000'), path])).values())

  const mergedExpandedPaths: string[][] = [...(expandedPaths || []), ...autoPersistedFromAP]
  const uniqExpanded = Array.from(new Map(mergedExpandedPaths.map(path => [path.join('\u0000'), path])).values())

  return {
    result: 'success',
    properties: newProperties,
    required: mergedRequired,
    hiddenPaths: hiddenPaths || [],
    expandedPaths: uniqExpanded,
    persistedPaths: uniqPersisted,
    sortPaths,
    forceViewMode,
    kind,
    isNamespaced,
    formPrefills: resolvedPrefill,
    namespacesData: namespacesData?.items?.map(item => item.metadata?.name).filter(Boolean),
  }
}
