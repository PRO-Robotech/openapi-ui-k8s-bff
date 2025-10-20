import {
  BASE_FRONTEND_PREFIX,
  BASE_CLUSTERNAME,
  BASE_FACTORY_NAMESPACED_API_KEY,
  BASE_FACTORY_CLUSTERSCOPED_API_KEY,
  BASE_FACTORY_NAMESPACED_BUILTIN_KEY,
  BASE_FACTORY_CLUSTERSCOPED_BUILTIN_KEY,
  BASE_NAMESPACE_FACTORY_KEY,
} from 'src/constants/envs'

export const getResourceLinkWithoutName = ({
  resource,
  apiGroup,
  apiVersion,
  isNamespaced,
  namespace,
}: {
  resource: string
  apiGroup?: string
  apiVersion: string
  isNamespaced?: boolean
  namespace?: string
}): string => {
  const namespacePrepared = namespace ? `/${namespace}` : `/{reqsJsonPath[0]['.metadata.namespace']['-']}`

  if (apiGroup) {
    return `${BASE_FRONTEND_PREFIX}/${BASE_CLUSTERNAME}${isNamespaced ? namespacePrepared : ''}/factory/${
      isNamespaced ? BASE_FACTORY_NAMESPACED_API_KEY : BASE_FACTORY_CLUSTERSCOPED_API_KEY
    }${apiGroup ? `/${apiGroup}` : ''}/${apiVersion}/${resource}`
  }

  return `${BASE_FRONTEND_PREFIX}/${BASE_CLUSTERNAME}${isNamespaced ? namespacePrepared : ''}/factory/${
    isNamespaced ? BASE_FACTORY_NAMESPACED_BUILTIN_KEY : BASE_FACTORY_CLUSTERSCOPED_BUILTIN_KEY
  }${apiGroup ? `/${apiGroup}` : ''}/${apiVersion}/${resource}`
}

export const getNamespaceLink = (): string => {
  return `${BASE_FRONTEND_PREFIX}/${BASE_CLUSTERNAME}/factory/${BASE_NAMESPACE_FACTORY_KEY}`
}
