export const UNSUPPORTED_V3_FORM_KEYWORDS = ['oneOf', 'anyOf', 'allOf', 'not', 'discriminator'] as const

export type TUnsupportedV3FormKeyword = (typeof UNSUPPORTED_V3_FORM_KEYWORDS)[number]

export type TV3SchemaSupportIssue = {
  keyword: TUnsupportedV3FormKeyword
  path: (string | number)[]
}

export type TV3SchemaSupportResult = {
  supported: boolean
  issues: TV3SchemaSupportIssue[]
}

type TV3SchemaNode = {
  properties?: Record<string, TV3SchemaNode>
  items?: TV3SchemaNode
  additionalProperties?: boolean | TV3SchemaNode
  oneOf?: unknown
  anyOf?: unknown
  allOf?: unknown
  not?: unknown
  discriminator?: unknown
}

/**
 * Policy guard for the v3-first forms pipeline.
 *
 * We intentionally support only the subset of OpenAPI v3 that maps cleanly to
 * our current form model. Metadata keywords such as `default`, `enum`,
 * `description`, and `nullable` are tolerated. Structural composition keywords
 * such as `oneOf` / `anyOf` / `allOf` / `not` / `discriminator` are considered
 * unsupported for auto-generated forms and should lead to Manual mode fallback.
 */
export const checkV3SchemaSupport = (schema: unknown): TV3SchemaSupportResult => {
  const issues: TV3SchemaSupportIssue[] = []

  const visit = (node: unknown, path: (string | number)[]) => {
    if (!node || typeof node !== 'object') return

    const schemaNode = node as TV3SchemaNode

    UNSUPPORTED_V3_FORM_KEYWORDS.forEach(keyword => {
      if (schemaNode[keyword] !== undefined) {
        issues.push({ keyword, path })
      }
    })

    Object.entries(schemaNode.properties || {}).forEach(([key, child]) => {
      visit(child, [...path, key])
    })

    if (schemaNode.items) {
      visit(schemaNode.items, [...path, '*'])
    }

    if (schemaNode.additionalProperties && typeof schemaNode.additionalProperties === 'object') {
      visit(schemaNode.additionalProperties, [...path, '<additionalProperties>'])
    }
  }

  visit(schema, [])

  return {
    supported: issues.length === 0,
    issues,
  }
}
