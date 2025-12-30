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
 * We support extensions beyond vanilla OpenAPI v2:
 * - custom schema "type" values (e.g. "multilineString")
 * - custom flags (e.g. isAdditionalProperties)
 *
 * So we widen the type locally instead of fighting openapi-types.
 */
export type ExtendedSchemaObject = Omit<
  OpenAPIV2.SchemaObject,
  'type' | 'properties' | 'items' | 'additionalProperties'
> & {
  type?: string | string[]
  properties?: Record<string, ExtendedSchemaObject>
  items?: Omit<OpenAPIV2.ItemsObject, 'type'> & { type?: string | string[] }
  additionalProperties?: boolean | ExtendedSchemaObject
  isAdditionalProperties?: boolean
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
 * NOTE: This is only used for keys that do NOT already exist in the swagger schema
 * AND when the parent doesn't provide an additionalProperties schema object.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const buildSchemaFromValue = (value: any): ExtendedSchemaObject => {
  const t = guessTypeFromValue(value)

  if (t === 'array') {
    const first = Array.isArray(value) && value.length > 0 ? value[0] : undefined
    const itemType = first !== undefined ? guessTypeFromValue(first) : 'string'

    const items: NonNullable<ExtendedSchemaObject['items']> = {
      type: itemType,
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
 * Build a schema node for an additional key using the parent's
 * `additionalProperties` schema object as a template.
 */
const buildSchemaFromAdditionalPropertiesSchema = (
  apSchema: ExtendedSchemaObject,
  value: unknown,
): ExtendedSchemaObject => {
  const cloned = _.cloneDeep(apSchema)

  return {
    ...cloned,
    default: value,
    isAdditionalProperties: true,
  }
}

/**
 * For every path with `additionalProperties: true` (or schema),
 * look into the prefillValuesSchema and create schema nodes ONLY for keys
 * that do *not* already exist in the swagger / mergedProperties schema.
 *
 * This prevents overwriting explicit definitions like `spec.sshKeys` (array<string>)
 * with AP-generated junk.
 */
export const getPropertiesToMerge = ({
  pathsWithAdditionalProperties,
  prefillValuesSchema,
  mergedProperties,
}: TArgs): { [name: string]: ExtendedSchemaObject } => {
  if (!prefillValuesSchema) return {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = {}

  for (const apPath of pathsWithAdditionalProperties) {
    const valueUnderPath = _.get(prefillValuesSchema, apPath)

    // Important: additionalProperties parents must be plain objects, not arrays/null.
    if (!valueUnderPath || typeof valueUnderPath !== 'object' || Array.isArray(valueUnderPath)) {
      continue
    }

    const parentSchema = _.get(mergedProperties, [...apPath]) as ExtendedSchemaObject | undefined
    const existingProps: Record<string, ExtendedSchemaObject> = parentSchema?.properties || {}

    const apSchema = parentSchema?.additionalProperties
    const apSchemaObject = apSchema && typeof apSchema === 'object' ? (apSchema as ExtendedSchemaObject) : undefined

    for (const [key, val] of Object.entries(valueUnderPath as Record<string, unknown>)) {
      // Don't treat explicitly-defined schema keys as additionalProperties-derived fields.
      if (key in existingProps) {
        continue
      }

      // Prefer the parent's additionalProperties schema object when present.
      const schemaNode = apSchemaObject
        ? buildSchemaFromAdditionalPropertiesSchema(apSchemaObject, val)
        : buildSchemaFromValue(val)

      const targetPath = [...apPath, 'properties', key]
      _.set(result, targetPath, schemaNode)
    }
  }

  return result
}
