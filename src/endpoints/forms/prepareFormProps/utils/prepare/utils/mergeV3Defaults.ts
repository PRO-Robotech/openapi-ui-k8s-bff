import { OpenAPIV2 } from 'openapi-types'

type TV3Schema = {
  type?: string
  default?: unknown
  properties?: Record<string, TV3Schema>
}

type TV3Document = {
  components?: {
    schemas?: Record<string, TV3Schema>
  }
}

/**
 * Finds the matching schema in an OpenAPI v3 document by looking through
 * `components.schemas` for an entry whose key ends with `.{kind}`.
 *
 * K8s v3 schema keys look like "com.prorobotech.incloud.v1.DemoApp"
 * or "io.k8s.api.apps.v1.Deployment". We match by the last segment.
 */
const findV3SchemaByKind = (v3Doc: TV3Document, kind: string): TV3Schema | undefined => {
  const schemas = v3Doc.components?.schemas
  if (!schemas) return undefined

  const suffix = `.${kind}`
  const matchingKey = Object.keys(schemas).find(key => key.endsWith(suffix))

  if (!matchingKey) return undefined
  return schemas[matchingKey]
}

/**
 * Recursively walks the v2 properties tree and merges `default` values
 * from the corresponding v3 schema into leaf properties that don't
 * already have a default.
 *
 * Only leaf fields get defaults: primitives (string, number, boolean)
 * and string arrays (for multi-select / listInput fields).
 * Object defaults are skipped to avoid the "partial nested structure"
 * problem.
 *
 * Mutates `v2Properties` in place for efficiency (caller passes a
 * deep-cloned copy from `prepare.ts`).
 */
const mergeDefaultsRecursive = (
  v2Properties: Record<string, OpenAPIV2.SchemaObject>,
  v3Properties: Record<string, TV3Schema> | undefined,
): void => {
  if (!v3Properties) return

  for (const key of Object.keys(v2Properties)) {
    const v2Prop = v2Properties[key]
    const v3Prop = v3Properties[key]

    if (!v3Prop) continue

    // Recurse into nested objects
    const nestedV2 = v2Prop.properties
    if (v2Prop.type === 'object' && nestedV2 && v3Prop.properties) {
      mergeDefaultsRecursive(nestedV2, v3Prop.properties)
      continue
    }

    // Merge default for leaf fields only
    if (v3Prop.default !== undefined && v2Prop.default === undefined) {
      const defaultType = typeof v3Prop.default
      if (defaultType === 'string' || defaultType === 'number' || defaultType === 'boolean') {
        v2Prop.default = v3Prop.default
      } else if (
        v2Prop.type === 'array'
        && Array.isArray(v3Prop.default)
        && v3Prop.default.every(item => typeof item === 'string')
      ) {
        v2Prop.default = v3Prop.default
      }
    }
  }
}

const isTV3Document = (doc: Record<string, unknown>): doc is TV3Document => {
  return typeof doc === 'object' && doc !== null && ('components' in doc || Object.keys(doc).length > 0)
}

/**
 * Merges OpenAPI v3 `default` values into v2 schema properties.
 *
 * This is the bridge between the v2 pipeline (which loses defaults during
 * K8s v3→v2 conversion) and the frontend (which expects `default` in
 * schema properties for placeholder display and "Apply default" button).
 *
 * Designed for graceful degradation: if v3Doc is undefined (K8s < 1.27
 * or network error), this function is a no-op.
 */
export const mergeV3Defaults = ({
  v2Properties,
  v3Doc,
  kind,
}: {
  v2Properties: Record<string, OpenAPIV2.SchemaObject>
  v3Doc: Record<string, unknown> | undefined
  kind: string | undefined
}): void => {
  if (!v3Doc || !kind) return
  if (!isTV3Document(v3Doc)) return

  const v3Schema = findV3SchemaByKind(v3Doc, kind)
  if (!v3Schema?.properties) return

  // Walks all top-level properties (spec, metadata, etc.) and recurses
  // into nested objects automatically via mergeDefaultsRecursive
  mergeDefaultsRecursive(v2Properties, v3Schema.properties)
}
