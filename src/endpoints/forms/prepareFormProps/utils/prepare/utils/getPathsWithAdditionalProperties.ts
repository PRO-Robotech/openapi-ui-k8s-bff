import { TFormSchemaNode, TFormSchemaProperties } from 'src/localTypes/formSchema'

const isSchemaNode = (value: unknown): value is TFormSchemaNode =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const walkSchemaNode = ({
  node,
  currentPath,
  result,
}: {
  node: TFormSchemaNode
  currentPath: (string | number)[]
  result: (string | number)[][]
}): void => {
  if (node.additionalProperties !== undefined) {
    result.push(currentPath)
  }

  Object.entries(node.properties || {}).forEach(([key, value]) => {
    if (!isSchemaNode(value)) return

    walkSchemaNode({
      node: value,
      currentPath: [...currentPath, 'properties', key],
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
  Object.entries(properties).forEach(([key, value]) => {
    if (!isSchemaNode(value)) return

    walkSchemaNode({
      node: value,
      currentPath: [...currentPath, key],
      result,
    })
  })

  return result
}
