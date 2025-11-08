import { OpenAPIV2 } from 'openapi-types'
import { TFormName } from 'src/localTypes/forms'
import { removeEmptyFormValues, renameBrokenFieldBack } from './removeAndRename'
import { normalizeValuesForQuotas } from './normalizeQuotas'
import { processMultilineInFormValues } from './multilineHandler'

export const onValuesChange = ({
  values,
  persistedKeys,
  properties,
}: {
  values: any
  persistedKeys: TFormName[]
  properties: OpenAPIV2.SchemaObject['properties']
}): any => {
  const cleanSchema = removeEmptyFormValues(values, persistedKeys)
  const fixedCleanSchema = renameBrokenFieldBack(cleanSchema)
  const quotasFixedSchema = normalizeValuesForQuotas(fixedCleanSchema, properties)
  const multilineProcessedSchema = processMultilineInFormValues(quotasFixedSchema)
  return multilineProcessedSchema
}
