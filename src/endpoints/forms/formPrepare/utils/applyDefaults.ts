import _ from 'lodash'

const clone = <T>(x: T): T => _.cloneDeep(x)

/**
 * Apply `value` as defaults onto an existing OpenAPI schema `schema`,
 * without changing the schema shape/types. Handles object/additionalProperties/arrays/primitives.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const applyDefaults = (schema: any, value: unknown): any => {
  if (!schema) return schema

  const s = clone(schema)
  const t = s.type

  // Primitive-ish
  if (t === 'string' || t === 'number' || t === 'integer' || t === 'boolean') {
    if (value !== undefined) {
      if (t === 'integer' && typeof value === 'number' && Number.isInteger(value)) s.default = value
      else if (t === 'number' && typeof value === 'number') s.default = value
      else if (t === 'string' && typeof value === 'string') s.default = value
      else if (t === 'boolean' && typeof value === 'boolean') s.default = value
    }
    return s
  }

  // Arrays: keep items schema, set whole-array default
  if (t === 'array') {
    if (Array.isArray(value)) s.default = value
    return s
  }

  // Objects
  if (t === 'object') {
    const valObj =
      value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined

    // 1) Populate defined properties
    if (s.properties && valObj) {
      const props = s.properties as Record<string, any>
      Object.keys(props).forEach(k => {
        props[k] = applyDefaults(props[k], valObj[k])
      })
    }

    // 2) Materialize additionalProperties entries for extra keys in the value
    if (valObj) {
      const known = new Set(Object.keys((s.properties ?? {}) as Record<string, any>))
      const ap = s.additionalProperties
      if (ap) {
        const ensureProps = () => {
          if (!s.properties) s.properties = {}
          return s.properties as Record<string, any>
        }
        Object.keys(valObj).forEach(k => {
          if (!known.has(k)) {
            ensureProps()[k] = applyDefaults(ap, valObj[k])
          }
        })
      }
    }

    return s
  }

  // If schema has no explicit type, just set default if it’s a JSON-serializable value
  if (value !== undefined) s.default = value
  return s
}
