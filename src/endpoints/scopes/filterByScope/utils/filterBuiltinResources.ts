import { OpenAPIV2 } from 'openapi-types'
import { TBuiltinResourceTypeList } from 'src/localTypes/k8s'
import { checkIfBuiltInInstanceNamespaceScoped } from 'src/utils/checkScope'

export const filterBuiltinResources = ({
  namespace,
  data,
  swaggerPaths,
}: {
  namespace?: string
  data?: TBuiltinResourceTypeList
  swaggerPaths: string[]
}): TBuiltinResourceTypeList['resources'] | undefined => {
  return namespace
    ? data?.resources?.filter(
        ({ name }) => checkIfBuiltInInstanceNamespaceScoped({ plural: name, swaggerPaths }).isNamespaceScoped,
      )
    : data?.resources
}
