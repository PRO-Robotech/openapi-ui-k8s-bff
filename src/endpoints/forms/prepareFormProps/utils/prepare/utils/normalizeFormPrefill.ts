import _ from 'lodash'
import { TFormPrefill, TFormPrefillPathSeg, TFormPrefillRaw, TFormPrefillValueEntry } from 'src/localTypes/formExtensions'

const normalizePathSeg = (segment: unknown): TFormPrefillPathSeg | undefined => {
  if (typeof segment === 'number') return segment
  if (typeof segment !== 'string') return undefined
  if (segment === '*') return segment
  if (/^\d+$/.test(segment)) return Number(segment)
  return segment
}

const normalizePath = (path: unknown): TFormPrefillPathSeg[] => {
  if (!Array.isArray(path)) return []
  return path
    .map(normalizePathSeg)
    .filter((segment): segment is TFormPrefillPathSeg => typeof segment !== 'undefined')
}

const isCanonicalValueEntry = (value: unknown): value is TFormPrefillValueEntry => {
  if (!_.isPlainObject(value)) return false
  const obj = value as Record<string, unknown>
  return Array.isArray(obj.path) && Object.prototype.hasOwnProperty.call(obj, 'value')
}

const isCanonicalValues = (values: unknown): values is TFormPrefillValueEntry[] =>
  Array.isArray(values) && values.every(isCanonicalValueEntry)

const flattenValuesObject = (
  node: unknown,
  currentPath: TFormPrefillPathSeg[] = [],
  out: TFormPrefillValueEntry[] = [],
): TFormPrefillValueEntry[] => {
  if (_.isPlainObject(node)) {
    const entries = Object.entries(node as Record<string, unknown>)

    // Preserve explicit empty-object leaf values at non-root paths.
    if (entries.length === 0 && currentPath.length > 0) {
      out.push({ path: currentPath, value: {} })
      return out
    }

    entries.forEach(([rawSeg, value]) => {
      const seg = normalizePathSeg(rawSeg)
      if (typeof seg === 'undefined') return
      flattenValuesObject(value, [...currentPath, seg], out)
    })
    return out
  }

  if (Array.isArray(node)) {
    // Preserve explicit empty-array leaf values at non-root paths.
    if (node.length === 0 && currentPath.length > 0) {
      out.push({ path: currentPath, value: [] })
      return out
    }

    node.forEach((value, index) => flattenValuesObject(value, [...currentPath, index], out))
    return out
  }

  // Scalars/null become leaf entries if path is non-empty.
  if (currentPath.length > 0) {
    out.push({ path: currentPath, value: node })
  }
  return out
}

export const normalizeFormPrefill = (prefill?: TFormPrefillRaw): TFormPrefill | undefined => {
  if (!prefill) return undefined

  const values = prefill.spec.values
  const normalizedValues = isCanonicalValues(values)
    ? values
        .map(({ path, value }) => ({ path: normalizePath(path), value }))
        .filter(({ path }) => path.length > 0)
    : flattenValuesObject(values)

  return {
    ...prefill,
    spec: {
      ...prefill.spec,
      values: normalizedValues,
    },
  }
}

