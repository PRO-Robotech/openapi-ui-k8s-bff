import _ from 'lodash'
import { OpenAPIV2 } from 'openapi-types'

export const getPathsWithAdditionalProperties = ({
  properties,
  currentPath = [],
  result = [],
}: {
  properties: OpenAPIV2.SchemaObject['properties']
  currentPath?: (string | number)[]
  result?: (string | number)[][]
}): (string | number)[][] => {
  if (properties) {
    Object.keys(properties).forEach((key: keyof typeof properties) => {
      const newPath = [...currentPath, key]
      if (key === 'additionalProperties') {
        result.push(currentPath)
      } else if (typeof properties[key] === 'object' && properties[key] !== null) {
        getPathsWithAdditionalProperties({ properties: properties[key], currentPath: newPath, result })
      }
    })
  }

  return result
}
