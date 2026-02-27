import { TJSON } from 'src/localTypes/JSON'

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)

const collectObjectKeyPaths = (node: unknown, currentPath: string[], out: string[][]): void => {
  if (!isRecord(node)) return

  Object.entries(node).forEach(([key, value]) => {
    const nextPath = [...currentPath, key]
    out.push(nextPath)
    collectObjectKeyPaths(value, nextPath, out)
  })
}

export const computePersistedPrefillPaths = ({ prefillValuesSchema }: { prefillValuesSchema?: TJSON }): string[][] => {
  if (!isRecord(prefillValuesSchema)) return []

  const out: string[][] = []
  collectObjectKeyPaths(prefillValuesSchema, [], out)
  return out
}
