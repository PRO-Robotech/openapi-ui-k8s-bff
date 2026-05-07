import _ from 'lodash'
import { TFormSchemaNode, TFormSchemaOneOfBranch, TFormSchemaProperties } from 'src/localTypes/formSchema'

type TV3FormSchemaNode = TFormSchemaNode & {
  allOf?: TV3FormSchemaNode[]
  oneOf?: TV3FormSchemaNode[]
  not?: TV3FormSchemaNode
}

type TMergeOptions = {
  preferOverlayAnnotations?: boolean
}

const MERGE_CONFLICT = Symbol('mergeConflict')
const warnedUnknownSchemaKeywords = new Set<string>()
const knownSchemaNodeKeys = new Set([
  'allOf',
  'oneOf',
  'oneOfRequiredGroups',
  'oneOfBranches',
  'not',
  'type',
  'properties',
  'items',
  'additionalProperties',
  'required',
  'enum',
  'default',
  'example',
  'nullable',
  'format',
  'pattern',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'minimum',
  'maximum',
  'description',
  'customProps',
  'isAdditionalProperties',
  'x-kubernetes-preserve-unknown-fields',
  'x-kubernetes-int-or-string',
])

const isSchemaNode = (value: unknown): value is TV3FormSchemaNode =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const mergeRequired = (base?: string[], overlay?: string[]): string[] | undefined => {
  const merged = [...(base || []), ...(overlay || [])]

  if (merged.length === 0) return undefined

  return Array.from(new Set(merged))
}

const mergeType = (
  base?: TFormSchemaNode['type'],
  overlay?: TFormSchemaNode['type'],
): TFormSchemaNode['type'] | typeof MERGE_CONFLICT | undefined => {
  if (base === undefined) return overlay
  if (overlay === undefined) return base

  const baseTypes = Array.isArray(base) ? base : [base]
  const overlayTypes = Array.isArray(overlay) ? overlay : [overlay]
  const merged = baseTypes.filter(type => overlayTypes.includes(type))

  if (merged.length === 0) return MERGE_CONFLICT
  if (merged.length === 1) return merged[0]

  return Array.from(new Set(merged))
}

const mergeEnum = (base?: string[], overlay?: string[]): string[] | typeof MERGE_CONFLICT | undefined => {
  if (base === undefined) return overlay
  if (overlay === undefined) return base

  const merged = base.filter(value => overlay.includes(value))

  if (merged.length === 0) return MERGE_CONFLICT

  return merged
}

const mergeMinimum = (base?: number, overlay?: number): number | undefined => {
  if (base === undefined) return overlay
  if (overlay === undefined) return base

  return Math.max(base, overlay)
}

const mergeMaximum = (base?: number, overlay?: number): number | undefined => {
  if (base === undefined) return overlay
  if (overlay === undefined) return base

  return Math.min(base, overlay)
}

const mergeMinLength = (base?: number, overlay?: number): number | undefined => {
  if (base === undefined) return overlay
  if (overlay === undefined) return base

  return Math.max(base, overlay)
}

const mergeMaxLength = (base?: number, overlay?: number): number | undefined => {
  if (base === undefined) return overlay
  if (overlay === undefined) return base

  return Math.min(base, overlay)
}

const mergeMinItems = (base?: number, overlay?: number): number | undefined => {
  if (base === undefined) return overlay
  if (overlay === undefined) return base

  return Math.max(base, overlay)
}

const mergeMaxItems = (base?: number, overlay?: number): number | undefined => {
  if (base === undefined) return overlay
  if (overlay === undefined) return base

  return Math.min(base, overlay)
}

const mergeStrictValue = <T>(
  base: T | undefined,
  overlay: T | undefined,
): T | typeof MERGE_CONFLICT | undefined => {
  if (base === undefined) return overlay
  if (overlay === undefined) return base

  return _.isEqual(base, overlay) ? overlay : MERGE_CONFLICT
}

const mergeAnnotationValue = <T>(
  base: T | undefined,
  overlay: T | undefined,
  { preferOverlayAnnotations = false }: TMergeOptions = {},
): T | typeof MERGE_CONFLICT | undefined => {
  if (base === undefined) return overlay
  if (overlay === undefined) return base

  if (_.isEqual(base, overlay)) return overlay

  return preferOverlayAnnotations ? overlay : MERGE_CONFLICT
}

const schemaAllowsNull = (node: TV3FormSchemaNode): boolean => {
  if (node.nullable === true) return true

  // An empty schema places no value restrictions, so JSON null remains valid.
  // As soon as `type` or `enum` appears, null is no longer allowed unless
  // the schema explicitly opts back in with `nullable: true`.
  return node.type === undefined && node.enum === undefined
}

const warnAboutUnknownSchemaKeywords = (node: TV3FormSchemaNode): void => {
  if (process.env.NODE_ENV !== 'development') {
    return
  }

  const unknownKeys = Object.keys(node).filter(key => !knownSchemaNodeKeys.has(key))

  if (unknownKeys.length === 0) {
    return
  }

  const warningKey = unknownKeys.slice().sort().join(',')

  if (warnedUnknownSchemaKeywords.has(warningKey)) {
    return
  }

  warnedUnknownSchemaKeywords.add(warningKey)

  console.warn('[openapi-v3-normalize]: unknown schema keyword(s) encountered during form normalization', {
    unknownKeys,
  })
}

const mergeNullable = (base: TV3FormSchemaNode, overlay: TV3FormSchemaNode): boolean | undefined => {
  const wantsNullable = base.nullable === true || overlay.nullable === true

  if (!wantsNullable) return undefined

  return schemaAllowsNull(base) && schemaAllowsNull(overlay) ? true : undefined
}

const mergeAdditionalProperties = (
  base?: boolean | TV3FormSchemaNode,
  overlay?: boolean | TV3FormSchemaNode,
  options?: TMergeOptions,
): boolean | TV3FormSchemaNode | typeof MERGE_CONFLICT | undefined => {
  if (base === undefined) return overlay
  if (overlay === undefined) return base

  if (base === true) return overlay
  if (overlay === true) return base
  if (base === false || overlay === false) return false

  if (isSchemaNode(base) && isSchemaNode(overlay)) {
    return mergeSchemaNodes(base, overlay, options)
  }

  return MERGE_CONFLICT
}

const mergeItems = (
  base?: TV3FormSchemaNode,
  overlay?: TV3FormSchemaNode,
  options?: TMergeOptions,
): TV3FormSchemaNode | typeof MERGE_CONFLICT | undefined => {
  if (base === undefined) return overlay
  if (overlay === undefined) return base

  return mergeSchemaNodes(base, overlay, options)
}

const mergeProperties = (
  base?: TFormSchemaProperties,
  overlay?: TFormSchemaProperties,
  options?: TMergeOptions,
): TFormSchemaProperties | typeof MERGE_CONFLICT | undefined => {
  if (!base && !overlay) return undefined

  const keys = new Set([...Object.keys(base || {}), ...Object.keys(overlay || {})])
  const merged: TFormSchemaProperties = {}

  for (const key of keys) {
    const baseValue = base?.[key]
    const overlayValue = overlay?.[key]

    if (baseValue && overlayValue) {
      const mergedValue = mergeSchemaNodes(baseValue, overlayValue, options)

      if (!mergedValue) return MERGE_CONFLICT

      merged[key] = mergedValue
      continue
    }

    merged[key] = overlayValue || baseValue!
  }

  return merged
}

const mergeSchemaNodes = (
  base: TV3FormSchemaNode,
  overlay: TV3FormSchemaNode,
  options?: TMergeOptions,
): TV3FormSchemaNode | undefined => {
  const {
    allOf: _baseAllOf,
    type: baseType,
    properties: baseProperties,
    items: baseItems,
    additionalProperties: baseAdditionalProperties,
    required: baseRequired,
    enum: baseEnum,
    oneOfRequiredGroups: baseOneOfRequiredGroups,
    oneOfBranches: baseOneOfBranches,
    default: baseDefault,
    example: baseExample,
    nullable: _baseNullable,
    format: baseFormat,
    pattern: basePattern,
    minLength: baseMinLength,
    maxLength: baseMaxLength,
    minItems: baseMinItems,
    maxItems: baseMaxItems,
    minimum: baseMinimum,
    maximum: baseMaximum,
    description: baseDescription,
    customProps: baseCustomProps,
    isAdditionalProperties: baseIsAdditionalProperties,
    'x-kubernetes-preserve-unknown-fields': basePreserveUnknownFields,
    'x-kubernetes-int-or-string': baseIntOrString,
    ...baseRest
  } = base

  const {
    allOf: _overlayAllOf,
    type: overlayType,
    properties: overlayProperties,
    items: overlayItems,
    additionalProperties: overlayAdditionalProperties,
    required: overlayRequired,
    enum: overlayEnum,
    oneOfRequiredGroups: overlayOneOfRequiredGroups,
    oneOfBranches: overlayOneOfBranches,
    default: overlayDefault,
    example: overlayExample,
    nullable: _overlayNullable,
    format: overlayFormat,
    pattern: overlayPattern,
    minLength: overlayMinLength,
    maxLength: overlayMaxLength,
    minItems: overlayMinItems,
    maxItems: overlayMaxItems,
    minimum: overlayMinimum,
    maximum: overlayMaximum,
    description: overlayDescription,
    customProps: overlayCustomProps,
    isAdditionalProperties: overlayIsAdditionalProperties,
    'x-kubernetes-preserve-unknown-fields': overlayPreserveUnknownFields,
    'x-kubernetes-int-or-string': overlayIntOrString,
    ...overlayRest
  } = overlay

  const mergedType = mergeType(baseType, overlayType)
  if (mergedType === MERGE_CONFLICT) return undefined

  const mergedProperties = mergeProperties(baseProperties, overlayProperties, options)
  if (mergedProperties === MERGE_CONFLICT) return undefined

  const mergedItems = mergeItems(baseItems, overlayItems, options)
  if (mergedItems === MERGE_CONFLICT) return undefined

  const mergedAdditionalProperties = mergeAdditionalProperties(
    baseAdditionalProperties,
    overlayAdditionalProperties,
    options,
  )
  if (mergedAdditionalProperties === MERGE_CONFLICT) return undefined

  const mergedEnum = mergeEnum(baseEnum, overlayEnum)
  if (mergedEnum === MERGE_CONFLICT) return undefined

  const mergedOneOfRequiredGroups = mergeStrictValue(baseOneOfRequiredGroups, overlayOneOfRequiredGroups)
  if (mergedOneOfRequiredGroups === MERGE_CONFLICT) return undefined

  const mergedOneOfBranches = mergeStrictValue(baseOneOfBranches, overlayOneOfBranches)
  if (mergedOneOfBranches === MERGE_CONFLICT) return undefined

  const mergedDefault = mergeAnnotationValue(baseDefault, overlayDefault, options)
  if (mergedDefault === MERGE_CONFLICT) return undefined

  const mergedExample = mergeAnnotationValue(baseExample, overlayExample, options)
  if (mergedExample === MERGE_CONFLICT) return undefined

  const mergedPattern = mergeStrictValue(basePattern, overlayPattern)
  if (mergedPattern === MERGE_CONFLICT) return undefined

  const mergedFormat = mergeStrictValue(baseFormat, overlayFormat)
  if (mergedFormat === MERGE_CONFLICT) return undefined

  const mergedMinLength = mergeMinLength(baseMinLength, overlayMinLength)
  const mergedMaxLength = mergeMaxLength(baseMaxLength, overlayMaxLength)

  if (mergedMinLength !== undefined && mergedMaxLength !== undefined && mergedMinLength > mergedMaxLength) return undefined

  const mergedMinItems = mergeMinItems(baseMinItems, overlayMinItems)
  const mergedMaxItems = mergeMaxItems(baseMaxItems, overlayMaxItems)

  if (mergedMinItems !== undefined && mergedMaxItems !== undefined && mergedMinItems > mergedMaxItems) return undefined

  const mergedMinimum = mergeMinimum(baseMinimum, overlayMinimum)
  const mergedMaximum = mergeMaximum(baseMaximum, overlayMaximum)

  if (mergedMinimum !== undefined && mergedMaximum !== undefined && mergedMinimum > mergedMaximum) return undefined

  const mergedCustomProps = mergeStrictValue(baseCustomProps, overlayCustomProps)
  if (mergedCustomProps === MERGE_CONFLICT) return undefined

  const mergedIsAdditionalProperties = mergeStrictValue(baseIsAdditionalProperties, overlayIsAdditionalProperties)
  if (mergedIsAdditionalProperties === MERGE_CONFLICT) return undefined

  const mergedPreserveUnknownFields = mergeStrictValue(basePreserveUnknownFields, overlayPreserveUnknownFields)
  if (mergedPreserveUnknownFields === MERGE_CONFLICT) return undefined

  const mergedIntOrString = mergeStrictValue(baseIntOrString, overlayIntOrString)
  if (mergedIntOrString === MERGE_CONFLICT) return undefined

  const mergedRequired = mergeRequired(baseRequired, overlayRequired)
  const mergedNullable = mergeNullable(base, overlay)

  return {
    ...baseRest,
    ...overlayRest,
    ...(mergedType !== undefined ? { type: mergedType } : {}),
    ...(mergedProperties ? { properties: mergedProperties } : {}),
    ...(mergedItems ? { items: mergedItems } : {}),
    ...(mergedAdditionalProperties !== undefined ? { additionalProperties: mergedAdditionalProperties } : {}),
    ...(mergedRequired ? { required: mergedRequired } : {}),
    ...(mergedEnum ? { enum: mergedEnum } : {}),
    ...(mergedOneOfRequiredGroups !== undefined ? { oneOfRequiredGroups: mergedOneOfRequiredGroups } : {}),
    ...(mergedOneOfBranches !== undefined ? { oneOfBranches: mergedOneOfBranches } : {}),
    ...(mergedDefault !== undefined ? { default: mergedDefault } : {}),
    ...(mergedExample !== undefined ? { example: mergedExample } : {}),
    ...(mergedNullable ? { nullable: mergedNullable } : {}),
    ...(mergedFormat !== undefined ? { format: mergedFormat } : {}),
    ...(mergedPattern !== undefined ? { pattern: mergedPattern } : {}),
    ...(mergedMinLength !== undefined ? { minLength: mergedMinLength } : {}),
    ...(mergedMaxLength !== undefined ? { maxLength: mergedMaxLength } : {}),
    ...(mergedMinItems !== undefined ? { minItems: mergedMinItems } : {}),
    ...(mergedMaxItems !== undefined ? { maxItems: mergedMaxItems } : {}),
    ...(mergedMinimum !== undefined ? { minimum: mergedMinimum } : {}),
    ...(mergedMaximum !== undefined ? { maximum: mergedMaximum } : {}),
    ...(overlayDescription || baseDescription ? { description: overlayDescription ?? baseDescription } : {}),
    ...(mergedCustomProps !== undefined ? { customProps: mergedCustomProps } : {}),
    ...(mergedIsAdditionalProperties !== undefined ? { isAdditionalProperties: mergedIsAdditionalProperties } : {}),
    ...(mergedPreserveUnknownFields !== undefined
      ? { 'x-kubernetes-preserve-unknown-fields': mergedPreserveUnknownFields }
      : {}),
    ...(mergedIntOrString !== undefined ? { 'x-kubernetes-int-or-string': mergedIntOrString } : {}),
  }
}

const normalizeAllOf = (node: TV3FormSchemaNode): TV3FormSchemaNode => {
  if (!Array.isArray(node.allOf) || node.allOf.length === 0) {
    return node
  }

  const allOfEntries = node.allOf.filter(isSchemaNode)

  if (allOfEntries.length !== node.allOf.length) {
    return node
  }

  const mergedAllOfEntries = allOfEntries.slice(1).reduce<TV3FormSchemaNode | undefined>(
    (current, entry) => {
      if (!current) return undefined

      return mergeSchemaNodes(current, entry)
    },
    allOfEntries[0],
  )

  if (!mergedAllOfEntries) {
    return node
  }

  const { allOf: _allOf, ...wrapperWithoutAllOf } = node
  const mergedWithWrapper = mergeSchemaNodes(mergedAllOfEntries, wrapperWithoutAllOf, {
    preferOverlayAnnotations: true,
  })

  return mergedWithWrapper || node
}

const isSupportedOneOfPropertyMarker = (value: unknown): boolean => {
  return isSchemaNode(value) && Object.keys(value).length === 0
}

const extractSupportedOneOfRequiredGroups = (node: TV3FormSchemaNode): string[][] | undefined => {
  if (!Array.isArray(node.oneOf) || node.oneOf.length === 0) {
    return undefined
  }

  if (node.type !== 'object' && !node.properties) {
    return undefined
  }

  if (!node.properties || Object.keys(node.properties).length === 0) {
    return undefined
  }

  const groups: string[][] = []

  for (const entry of node.oneOf) {
    if (!isSchemaNode(entry)) {
      return undefined
    }

    const { required, properties, ...rest } = entry

    if (Object.keys(rest).length > 0) {
      return undefined
    }

    if (!Array.isArray(required) || required.length === 0 || required.some(value => typeof value !== 'string' || !value)) {
      return undefined
    }

    if (
      properties &&
      Object.entries(properties).some(([key, value]) => !required.includes(key) || !isSupportedOneOfPropertyMarker(value))
    ) {
      return undefined
    }

    groups.push(Array.from(new Set(required)))
  }

  return groups
}

type TOneOfBranchExtractionResult =
  | {
      supported: true
      branch: TFormSchemaOneOfBranch
    }
  | {
      supported: false
    }

const isSupportedOneOfMatchValue = (value: unknown): value is string | number | boolean => {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

const getUniqueStringList = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined
  }

  if (value.some(item => typeof item !== 'string' || !item)) {
    return undefined
  }

  return Array.from(new Set(value))
}

const hasDeclaredProperty = (properties: TFormSchemaProperties, key: string): boolean => {
  return Object.prototype.hasOwnProperty.call(properties, key)
}

const extractSupportedOneOfPropertyMatch = (value: unknown): string | number | boolean | undefined => {
  if (!isSchemaNode(value)) {
    return undefined
  }

  const { enum: enumValues, ...rest } = value

  if (Object.keys(rest).length > 0) {
    return undefined
  }

  if (!Array.isArray(enumValues) || enumValues.length !== 1) {
    return undefined
  }

  const [matchValue] = enumValues

  return isSupportedOneOfMatchValue(matchValue) ? matchValue : undefined
}

const extractSupportedOneOfBranch = (
  entry: unknown,
  parentProperties: TFormSchemaProperties,
): TOneOfBranchExtractionResult => {
  if (!isSchemaNode(entry)) {
    return { supported: false }
  }

  const { required, properties, not, ...rest } = entry

  if (Object.keys(rest).length > 0) {
    return { supported: false }
  }

  const requiredFields = getUniqueStringList(required)

  if (!requiredFields || requiredFields.some(field => !hasDeclaredProperty(parentProperties, field))) {
    return { supported: false }
  }

  const branch: TFormSchemaOneOfBranch = {
    required: requiredFields,
  }

  if (properties !== undefined) {
    const match: NonNullable<TFormSchemaOneOfBranch['match']> = {}

    for (const [key, value] of Object.entries(properties)) {
      if (!hasDeclaredProperty(parentProperties, key)) {
        return { supported: false }
      }

      const matchValue = extractSupportedOneOfPropertyMatch(value)

      if (matchValue === undefined) {
        return { supported: false }
      }

      match[key] = matchValue
    }

    if (Object.keys(match).length > 0) {
      branch.match = match
    }
  }

  if (not !== undefined) {
    if (!isSchemaNode(not)) {
      return { supported: false }
    }

    const { required: notRequired, ...notRest } = not

    if (Object.keys(notRest).length > 0) {
      return { supported: false }
    }

    const forbiddenFields = getUniqueStringList(notRequired)

    if (!forbiddenFields || forbiddenFields.some(field => !hasDeclaredProperty(parentProperties, field))) {
      return { supported: false }
    }

    branch.forbidden = forbiddenFields
  }

  return {
    supported: true,
    branch,
  }
}

const extractSupportedOneOfBranches = (node: TV3FormSchemaNode): TFormSchemaOneOfBranch[] | undefined => {
  if (!Array.isArray(node.oneOf) || node.oneOf.length === 0) {
    return undefined
  }

  if (node.type !== 'object' && !node.properties) {
    return undefined
  }

  if (!node.properties || Object.keys(node.properties).length === 0) {
    return undefined
  }

  const branches: TFormSchemaOneOfBranch[] = []

  for (const entry of node.oneOf) {
    const result = extractSupportedOneOfBranch(entry, node.properties)

    if (!result.supported) {
      return undefined
    }

    branches.push(result.branch)
  }

  return branches
}

const normalizeOneOf = (node: TV3FormSchemaNode): TV3FormSchemaNode => {
  const oneOfRequiredGroups = extractSupportedOneOfRequiredGroups(node)

  if (oneOfRequiredGroups) {
    const { oneOf: _oneOf, ...nodeWithoutOneOf } = node

    return {
      ...nodeWithoutOneOf,
      oneOfRequiredGroups,
    }
  }

  const oneOfBranches = extractSupportedOneOfBranches(node)

  if (!oneOfBranches) {
    return node
  }

  const { oneOf: _oneOf, ...nodeWithoutOneOf } = node

  return {
    ...nodeWithoutOneOf,
    oneOfBranches,
  }
}

const normalizeSchemaNode = (node: TV3FormSchemaNode): TV3FormSchemaNode => {
  warnAboutUnknownSchemaKeywords(node)

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
  const normalizedOneOf = Array.isArray(node.oneOf)
    ? node.oneOf.map(item => (isSchemaNode(item) ? normalizeSchemaNode(item) : item))
    : node.oneOf

  const normalizedNode: TV3FormSchemaNode = {
    ...node,
    ...(normalizedProperties ? { properties: normalizedProperties } : {}),
    ...(normalizedItems ? { items: normalizedItems } : {}),
    ...(normalizedAdditionalProperties !== undefined ? { additionalProperties: normalizedAdditionalProperties } : {}),
    ...(normalizedAllOf ? { allOf: normalizedAllOf } : {}),
    ...(normalizedOneOf ? { oneOf: normalizedOneOf } : {}),
  }

  return normalizeOneOf(normalizeAllOf(normalizedNode))
}

/**
 * Kubernetes OpenAPI v3 frequently uses `allOf` both as a wrapper around
 * reusable metadata schemas and as a way to compose compatible object-like
 * fragments. We flatten only the subset that can be merged into a regular
 * form-schema node without introducing ambiguity for the current renderer.
 * Conflicting composition is preserved so the unsupported-keyword policy still
 * routes those schemas to Manual mode.
 */
export const normalizeV3SchemaForForms = (schema: TFormSchemaNode): TFormSchemaNode => {
  return normalizeSchemaNode(schema)
}
