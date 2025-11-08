import _ from 'lodash'

export const buildNestedObject = ({
  path,
  defaultValue,
}: {
  path: (string | number)[]
  defaultValue: unknown
}): Record<string, unknown> => {
  if (path.length === 0) {
    return {}
  }

  const [firstKey, ...remainingKeys] = path

  if (remainingKeys.length === 0) {
    return { [firstKey]: defaultValue }
  }

  return { [firstKey]: buildNestedObject({ path: remainingKeys, defaultValue }) }
}
