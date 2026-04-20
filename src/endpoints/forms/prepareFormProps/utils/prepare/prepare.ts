import { TPrepareForm } from 'src/localTypes/forms'
import { TPrepareFormRes } from 'src/localTypes/endpoints/forms'
import { finalizePreparedForm, resolvePrepareSchemaSource } from './utils'

export const prepare = async ({
  data,
  formsOverridesData,
  formsPrefillsData,
  customizationId,
  customizationIdPrefill,
  partsOfUrl,
  namespacesData,
}: TPrepareForm): Promise<TPrepareFormRes> => {
  const schemaSourceResult = await resolvePrepareSchemaSource({ data })

  if (schemaSourceResult.status !== 'success') {
    return {
      result: 'error',
      error: schemaSourceResult.error,
      isNamespaced: 'isNamespaced' in schemaSourceResult ? schemaSourceResult.isNamespaced : false,
      kind: 'kind' in schemaSourceResult ? schemaSourceResult.kind : undefined,
      fallbackToManualMode: true,
    }
  }

  return finalizePreparedForm({
    data,
    formsOverridesData,
    formsPrefillsData,
    customizationId,
    customizationIdPrefill,
    partsOfUrl,
    namespacesData,
    ...schemaSourceResult,
  })
}
