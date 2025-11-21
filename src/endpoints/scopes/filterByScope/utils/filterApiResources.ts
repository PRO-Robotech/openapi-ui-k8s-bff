import { OpenAPIV2 } from 'openapi-types'
import { TApiGroupResourceTypeList } from 'src/localTypes/k8s'
import { checkIfApiInstanceNamespaceScoped } from 'src/utils/checkScope'

export const filterApiResources = ({
  namespace,
  data,
  apiGroup,
  apiVersion,
  swaggerPaths,
}: {
  namespace?: string
  data?: TApiGroupResourceTypeList
  apiGroup: string
  apiVersion: string
  swaggerPaths: string[]
}): TApiGroupResourceTypeList['resources'] | undefined => {
  return namespace
    ? data?.resources.filter(
        ({ name }) =>
          checkIfApiInstanceNamespaceScoped({ plural: name, apiGroup, apiVersion, swaggerPaths }).isNamespaceScoped,
      )
    : data?.resources
}
