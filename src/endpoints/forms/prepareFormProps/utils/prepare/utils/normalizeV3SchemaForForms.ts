import { TFormSchemaNode, TFormSchemaProperties } from 'src/localTypes/formSchema'

type TV3FormSchemaNode = TFormSchemaNode & {
  allOf?: TV3FormSchemaNode[]
}

const isSchemaNode = (value: unknown): value is TV3FormSchemaNode =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const mergeRequired = (base?: string[], overlay?: string[]): string[] | undefined => {
  const merged = [...(base || []), ...(overlay || [])]

  if (merged.length === 0) return undefined

  return Array.from(new Set(merged))
}

const mergeProperties = (
  base?: TFormSchemaProperties,
  overlay?: TFormSchemaProperties,
): TFormSchemaProperties | undefined => {
  if (!base && !overlay) return undefined

  const keys = new Set([...Object.keys(base || {}), ...Object.keys(overlay || {})])
  const merged: TFormSchemaProperties = {}

  keys.forEach(key => {
    const baseValue = base?.[key]
    const overlayValue = overlay?.[key]

    if (baseValue && overlayValue) {
      merged[key] = mergeSchemaNodes(baseValue, overlayValue)
      return
    }

    merged[key] = overlayValue || baseValue!
  })

  return merged
}

const mergeAdditionalProperties = (
  base?: boolean | TV3FormSchemaNode,
  overlay?: boolean | TV3FormSchemaNode,
): boolean | TV3FormSchemaNode | undefined => {
  if (overlay === undefined) return base
  if (base === undefined) return overlay

  if (isSchemaNode(base) && isSchemaNode(overlay)) {
    return mergeSchemaNodes(base, overlay)
  }

  return overlay
}

const mergeSchemaNodes = (base: TV3FormSchemaNode, overlay: TV3FormSchemaNode): TV3FormSchemaNode => {
  const mergedItems =
    isSchemaNode(base.items) && isSchemaNode(overlay.items)
      ? mergeSchemaNodes(base.items, overlay.items)
      : overlay.items || base.items

  const mergedAdditionalProperties = mergeAdditionalProperties(base.additionalProperties, overlay.additionalProperties)
  const mergedProperties = mergeProperties(base.properties, overlay.properties)
  const mergedRequired = mergeRequired(base.required, overlay.required)

  return {
    ...base,
    ...overlay,
    ...(mergedItems ? { items: mergedItems } : {}),
    ...(mergedAdditionalProperties !== undefined ? { additionalProperties: mergedAdditionalProperties } : {}),
    ...(mergedProperties ? { properties: mergedProperties } : {}),
    ...(mergedRequired ? { required: mergedRequired } : {}),
  }
}

const normalizeSchemaNode = (node: TV3FormSchemaNode): TV3FormSchemaNode => {
  const normalizedProperties = node.properties
    ? Object.fromEntries(
        Object.entries(node.properties).map(([key, value]) => [key, normalizeSchemaNode(value as TV3FormSchemaNode)]),
      )
    : undefined

  const normalizedItems = isSchemaNode(node.items) ? normalizeSchemaNode(node.items) : node.items
  const normalizedAdditionalProperties = isSchemaNode(node.additionalProperties)
    ? normalizeSchemaNode(node.additionalProperties)
    : node.additionalProperties
  const normalizedAllOf = Array.isArray(node.allOf)
    ? node.allOf.map(item => (isSchemaNode(item) ? normalizeSchemaNode(item) : item))
    : node.allOf

  const normalizedNode: TV3FormSchemaNode = {
    ...node,
    ...(normalizedProperties ? { properties: normalizedProperties } : {}),
    ...(normalizedItems ? { items: normalizedItems } : {}),
    ...(normalizedAdditionalProperties !== undefined ? { additionalProperties: normalizedAdditionalProperties } : {}),
    ...(normalizedAllOf ? { allOf: normalizedAllOf } : {}),
  }

  if (Array.isArray(normalizedNode.allOf) && normalizedNode.allOf.length === 1 && isSchemaNode(normalizedNode.allOf[0])) {
    const { allOf: _allOf, ...wrapperWithoutAllOf } = normalizedNode
    return mergeSchemaNodes(normalizedNode.allOf[0], wrapperWithoutAllOf)
  }

  return normalizedNode
}

/**
 * Kubernetes OpenAPI v3 frequently wraps reusable metadata schemas in a
 * singleton `allOf`, e.g. `metadata -> allOf -> ObjectMeta`. That shape is
 * semantically equivalent to the inner schema for our form renderer, so we
 * unwrap it before applying the unsupported-keyword policy. Real composition
 * with multiple `allOf` entries is preserved and still falls back to Manual.
 */
export const normalizeV3SchemaForForms = (schema: TFormSchemaNode): TFormSchemaNode => {
  return normalizeSchemaNode(schema)
}
