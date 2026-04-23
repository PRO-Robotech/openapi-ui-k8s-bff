import { TFormName } from 'src/localTypes/forms'
import { TFormSchemaProperties } from 'src/localTypes/formSchema'
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
  properties: TFormSchemaProperties
}): any => {
  const cleanSchema = removeEmptyFormValues(values, persistedKeys, properties)
  const fixedCleanSchema = renameBrokenFieldBack(cleanSchema)
  const quotasFixedSchema = normalizeValuesForQuotas(fixedCleanSchema, properties)
  const multilineProcessedSchema = processMultilineInFormValues(quotasFixedSchema)
  return multilineProcessedSchema
}
