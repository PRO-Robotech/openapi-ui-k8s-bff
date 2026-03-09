import { TFormPrefill, TFormPrefillPathSeg } from 'src/localTypes/formExtensions'

const flattenValueToPaths = (
  value: unknown,
  currentPath: TFormPrefillPathSeg[],
  out: TFormPrefillPathSeg[][],
): void => {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      out.push(currentPath)
      return
    }

    value.forEach((item, index) => flattenValueToPaths(item, [...currentPath, index], out))
    return
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)

    if (entries.length === 0) {
      out.push(currentPath)
      return
    }

    entries.forEach(([key, nestedValue]) => flattenValueToPaths(nestedValue, [...currentPath, key], out))
    return
  }

  out.push(currentPath)
}

export const computePersistedFormPrefillPaths = (prefill?: TFormPrefill): TFormPrefillPathSeg[][] => {
  if (!prefill) return []

  const out: TFormPrefillPathSeg[][] = []

  prefill.spec.values.forEach(({ path, value }) => {
    if (path.length === 0) return
    flattenValueToPaths(value, path, out)
  })

  return out
}
