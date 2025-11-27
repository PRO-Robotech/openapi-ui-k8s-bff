// src/endpoints/forms/prepareFormProps/utils/getPropertiesToMerge.ts
import _ from 'lodash'
import { OpenAPIV2 } from 'openapi-types'

type TArgs = {
  pathsWithAdditionalProperties: (string | number)[][]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prefillValuesSchema?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mergedProperties: any
}

/**
 * Infer a simple OpenAPI-ish type from a JS value.
 */
const guessTypeFromValue = (value: unknown): string => {
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'string') return 'string'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (value && typeof value === 'object') return 'object'
  return 'string'
}

/**
 * Build a schema node for an "additional" property based purely on its value.
 * NOTE: This is only used for keys that do NOT already exist in the swagger schema.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const buildSchemaFromValue = (value: any): OpenAPIV2.SchemaObject => {
  const t = guessTypeFromValue(value)

  if (t === 'array') {
    const first = Array.isArray(value) && value.length > 0 ? value[0] : undefined
    const itemType = first !== undefined ? guessTypeFromValue(first) : 'string'

    const items: OpenAPIV2.ItemsObject = {
      // ItemsObject.type is `string | string[] | undefined`, so a plain string is fine
      type: itemType as OpenAPIV2.ItemsObject['type'],
    }

    return {
      type: 'array',
      items,
      default: value,
      isAdditionalProperties: true,
    }
  }

  if (t === 'object') {
    return {
      type: 'object',
      properties: {},
      default: value,
      isAdditionalProperties: true,
    }
  }

  // primitive
  return {
    type: t,
    default: value,
    isAdditionalProperties: true,
  }
}

/**
 * For every path with `additionalProperties: true`, look into the prefillValuesSchema
 * and create schema nodes ONLY for keys that do *not* already exist in the swagger
 * / mergedProperties schema.
 *
 * This prevents overwriting explicit definitions like `spec.sshKeys` (array<string>)
 * with AP-generated junk like { type: "object", ... }.
 */
export const getPropertiesToMerge = ({
  pathsWithAdditionalProperties,
  prefillValuesSchema,
  mergedProperties,
}: TArgs): { [name: string]: OpenAPIV2.SchemaObject } => {
  if (!prefillValuesSchema) return {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = {}

  for (const apPath of pathsWithAdditionalProperties) {
    // e.g. apPath = ['spec']
    const valueUnderPath = _.get(prefillValuesSchema, apPath)

    if (!valueUnderPath || typeof valueUnderPath !== 'object') {
      continue
    }

    // Existing schema at this AP parent (e.g. schema for `spec`)
    const parentSchema = _.get(mergedProperties, [...apPath])
    const existingProps: Record<string, OpenAPIV2.SchemaObject> = parentSchema?.properties || {}

    // For each key directly under this AP parent
    for (const [key, val] of Object.entries(valueUnderPath as Record<string, unknown>)) {
      // If the key already exists in the schema (e.g. "sshKeys" declared as array<string> in CRD),
      // DO NOT treat it as an additionalProperties-derived field.
      if (existingProps[key]) {
        continue
      }

      // This is a truly "additional" key under an AP object -> build a schema for it
      const schemaNode = buildSchemaFromValue(val)

      const targetPath = [...apPath, 'properties', key]
      _.set(result, targetPath, schemaNode)
    }
  }

  return result
}
