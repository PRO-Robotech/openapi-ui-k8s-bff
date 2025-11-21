import _ from 'lodash'
import { OpenAPIV2 } from 'openapi-types'
import { TJSON } from 'src/localTypes/JSON'
import { checkIfApiInstanceNamespaceScoped, checkIfBuiltInInstanceNamespaceScoped } from 'src/utils/checkScope'

export const getSwaggerPathAndIsNamespaceScoped = ({
  swaggerPaths,
  data,
}: {
  swaggerPaths: string[]
  data:
    | {
        type: 'builtin'
        plural: string
        prefillValuesSchema?: TJSON
        prefillValueNamespaceOnly?: string
      }
    | {
        type: 'apis'
        apiGroup: string
        apiVersion: string
        plural: string
        prefillValuesSchema?: TJSON
        prefillValueNamespaceOnly?: string
      }
}): { swaggerPath: string; isNamespaced: boolean } => {
  let swaggerPath: string = ''
  let isNamespaced: boolean = false

  if (data.type === 'builtin') {
    const { isNamespaceScoped } = checkIfBuiltInInstanceNamespaceScoped({
      plural: data.plural,
      swaggerPaths,
    })
    if (isNamespaceScoped) {
      isNamespaced = true
    }
    swaggerPath = `/api/v1${isNamespaceScoped ? '/namespaces/{namespace}' : ''}/${data.plural}`
  } else {
    const { isNamespaceScoped } = checkIfApiInstanceNamespaceScoped({
      apiGroup: data.apiGroup,
      apiVersion: data.apiVersion,
      plural: data.plural,
      swaggerPaths,
    })
    if (isNamespaceScoped) {
      isNamespaced = true
    }
    swaggerPath = `/apis/${data.apiGroup}/${data.apiVersion}${isNamespaceScoped ? '/namespaces/{namespace}' : ''}/${
      data.plural
    }`
  }

  return { swaggerPath, isNamespaced }
}
