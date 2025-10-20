import _ from 'lodash'
import { TJSON } from 'src/localTypes/JSON'
import { deepMerge } from 'src/utils/deepMerge'
import { buildNestedObject } from './buildNestedObject'
import { applyDefaults } from './applyDefaults'

export const getPropertiesToMerge = ({
  pathsWithAdditionalProperties,
  prefillValuesSchema,
  bodyParametersSchema,
}: {
  pathsWithAdditionalProperties: (string | number)[][]
  prefillValuesSchema?: TJSON | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bodyParametersSchema: any
}): Record<string, unknown> => {
  return pathsWithAdditionalProperties.reduce((acc: Record<string, unknown>, path: (string | number)[]) => {
    const pathWithoutProperties = path.filter((_, i) => {
      return i % 2 === 0
    })
    let prefillVals = null
    try {
      prefillVals = _.get(prefillValuesSchema, pathWithoutProperties.join('.'))
      // eslint-disable-next-line no-empty, @typescript-eslint/no-unused-vars
    } catch (e) {}

    if (prefillVals) {
      const apSchemaPath = `${path.join('.')}.additionalProperties`
      const additionalPropSchema = _.get(bodyParametersSchema.properties, apSchemaPath)
      const prefillValsType = _.get(bodyParametersSchema.properties, `${path.join('.')}.additionalProperties.type`)

      const openapiValues: Record<string, unknown> = { properties: {} }

      if (additionalPropSchema) {
        Object.keys(prefillVals).forEach(el => {
          const schemaClone = _.clone(additionalPropSchema)
          const schemaWithDefaults = applyDefaults(schemaClone, prefillVals[el])

          ;(openapiValues.properties as Record<string, unknown>)[el] = {
            ...schemaWithDefaults,
            isAdditionalProperties: true,
          }
        })
      } else {
        // Fallback: retain your old behavior if the schema isn't found (optional)
        Object.keys(prefillVals).forEach(el => {
          ;(openapiValues.properties as Record<string, unknown>)[el] = {
            type: prefillValsType,
            isAdditionalProperties: true,
            default: prefillVals[el],
          }
        })
      }

      const newEntryInMergeObject = buildNestedObject({ path, defaultValue: openapiValues })
      const localResult = deepMerge(acc, newEntryInMergeObject)
      return localResult
    }
    return acc
  }, {})
}
