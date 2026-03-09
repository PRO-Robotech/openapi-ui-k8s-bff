import { TJSON } from 'src/localTypes/JSON'

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)

const collectPersistedPaths = (node: unknown, currentPath: (string | number)[], out: (string | number)[][]): void => {
  if (Array.isArray(node)) {
    node.forEach((value, index) => {
      const nextPath = [...currentPath, index]
      out.push(nextPath)
      collectPersistedPaths(value, nextPath, out)
    })
    return
  }

  if (!isRecord(node)) return

  Object.entries(node).forEach(([key, value]) => {
    const nextPath = [...currentPath, key]
    out.push(nextPath)
    collectPersistedPaths(value, nextPath, out)
  })
}

export const computePersistedPrefillPaths = ({
  prefillValuesSchema,
}: {
  prefillValuesSchema?: TJSON
}): (string | number)[][] => {
  if (!isRecord(prefillValuesSchema)) return []

  const out: (string | number)[][] = []
  collectPersistedPaths(prefillValuesSchema, [], out)
  return out
}
