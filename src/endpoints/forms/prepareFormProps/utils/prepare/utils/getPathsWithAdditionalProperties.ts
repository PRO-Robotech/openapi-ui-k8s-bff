import _ from 'lodash'
import { TFormSchemaProperties } from 'src/localTypes/formSchema'

const walkSchema = ({
  node,
  currentPath,
  result,
}: {
  node: unknown
  currentPath: (string | number)[]
  result: (string | number)[][]
}): void => {
  if (!node || typeof node !== 'object') return

  Object.entries(node as Record<string, unknown>).forEach(([key, value]) => {
    if (key === 'additionalProperties') {
      result.push(currentPath)
      return
    }

    walkSchema({
      node: value,
      currentPath: [...currentPath, key],
      result,
    })
  })
}

export const getPathsWithAdditionalProperties = ({
  properties,
  currentPath = [],
  result = [],
}: {
  properties: TFormSchemaProperties
  currentPath?: (string | number)[]
  result?: (string | number)[][]
}): (string | number)[][] => {
  walkSchema({ node: properties, currentPath, result })
  return result
}
