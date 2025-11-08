import _ from 'lodash'
import { OpenAPIV2 } from 'openapi-types'
import { TJSON } from 'src/localTypes/JSON'
import { deepMerge } from 'src/utils/deepMerge'
import { buildNestedObject } from './buildNestedObject'
import { applyDefaults } from './applyDefaults'

export const getPropertiesToMerge = ({
  pathsWithAdditionalProperties,
  prefillValuesSchema,
  mergedProperties,
}: {
  pathsWithAdditionalProperties: (string | number)[][]
  prefillValuesSchema?: TJSON | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mergedProperties: {
    [name: string]: OpenAPIV2.SchemaObject
  }
}): Record<string, unknown> => {
  return pathsWithAdditionalProperties.reduce((acc: Record<string, unknown>, path: (string | number)[]) => {
    const pathWithoutProperties = path.filter((_, i) => {
      return i % 2 === 0
    })
    let prefillVals = null
    try {
      prefillVals = _.get(prefillValuesSchema, pathWithoutProperties.join('.'))
      // eslint-disable-next-line no-empty, @typescript-eslint/no-unused-vars
    } catch (error) {
      console.error('[prefillVals-get] Error:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        error: error,
      })
    }

    if (prefillVals) {
      const apSchemaPath = `${path.join('.')}.additionalProperties`
      const additionalPropSchema = _.get(mergedProperties, apSchemaPath)
      const prefillValsType = _.get(mergedProperties, `${path.join('.')}.additionalProperties.type`)

      const openapiValues: Record<string, unknown> = { properties: {} }

      // Check that additionalPropSchema is a schema object, not a primitive
      if (additionalPropSchema && typeof additionalPropSchema === 'object' && !Array.isArray(additionalPropSchema)) {
        Object.keys(prefillVals).forEach(el => {
          const schemaClone = _.clone(additionalPropSchema)
          const schemaWithDefaults = applyDefaults(schemaClone, prefillVals[el])

          ;(openapiValues.properties as Record<string, unknown>)[el] = {
            ...schemaWithDefaults,
            isAdditionalProperties: true,
          }
        })
      } else {
        // Fallback: if schema is not found or is a primitive
        Object.keys(prefillVals).forEach(el => {
          ;(openapiValues.properties as Record<string, unknown>)[el] = {
            type: prefillValsType || (typeof prefillVals[el] === 'object' ? 'object' : typeof prefillVals[el]),
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
