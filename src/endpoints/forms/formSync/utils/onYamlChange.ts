import { TFormSchemaProperties } from 'src/localTypes/formSchema'
import { renameBrokenFieldBackToFormAgain } from './removeAndRename'
import { normalizeValuesForQuotasToNumber } from './normalizeQuotas'

export const onYamlChange = ({
  values,
  properties,
}: {
  values: Record<string, unknown>
  properties: TFormSchemaProperties
}): any => {
  const normalizedValues = renameBrokenFieldBackToFormAgain(values)
  const normalizedValuesWithQuotas = normalizeValuesForQuotasToNumber(normalizedValues, properties)
  if (normalizedValues) {
    return normalizedValuesWithQuotas
  }
  return undefined
}
