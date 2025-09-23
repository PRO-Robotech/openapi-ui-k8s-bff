import { OpenAPIV2 } from 'openapi-types'
import { renameBrokenFieldBackToFormAgain } from './removeAndRename'
import { normalizeValuesForQuotasToNumber } from './normalizeQuotas'
import { processMultilineInYaml } from './multilineHandler'

export const onYamlChange = ({
  values,
  properties,
}: {
  values: Record<string, unknown>
  properties: OpenAPIV2.SchemaObject['properties']
}): any => {
  const normalizedValues = renameBrokenFieldBackToFormAgain(values)
  const normalizedValuesWithQuotas = normalizeValuesForQuotasToNumber(normalizedValues, properties)
  if (normalizedValues) {
    return normalizedValuesWithQuotas
  }
  return undefined
}
