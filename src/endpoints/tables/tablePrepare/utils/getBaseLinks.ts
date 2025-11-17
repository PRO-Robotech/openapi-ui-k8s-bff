import {
  BASE_FRONTEND_PREFIX,
  BASE_FACTORY_NAMESPACED_API_KEY,
  BASE_FACTORY_CLUSTERSCOPED_API_KEY,
  BASE_FACTORY_NAMESPACED_BUILTIN_KEY,
  BASE_FACTORY_CLUSTERSCOPED_BUILTIN_KEY,
  BASE_NAMESPACE_FACTORY_KEY,
} from 'src/constants/envs'

const getFactoryKey = ({
  apiGroup,
  apiVersion,
  resource,
  isNamespaced,
  baseFactoriesMapping,
}: {
  resource: string
  apiGroup?: string
  apiVersion: string
  isNamespaced?: boolean
  baseFactoriesMapping?: Record<string, string> | undefined
}): string => {
  if (isNamespaced) {
    if (apiGroup) {
      const forcedMapping =
        baseFactoriesMapping?.[`${BASE_FACTORY_NAMESPACED_API_KEY}-${apiGroup}-${apiVersion}-${resource}`]
      return forcedMapping || BASE_FACTORY_NAMESPACED_API_KEY || ''
    }

    const forcedMapping = baseFactoriesMapping?.[`${BASE_FACTORY_NAMESPACED_BUILTIN_KEY}-${apiVersion}-${resource}`]
    return forcedMapping || BASE_FACTORY_NAMESPACED_BUILTIN_KEY || ''
  }

  if (apiGroup) {
    const forcedMapping =
      baseFactoriesMapping?.[`${BASE_FACTORY_CLUSTERSCOPED_API_KEY}-${apiGroup}-${apiVersion}-${resource}`]
    return forcedMapping || BASE_FACTORY_CLUSTERSCOPED_API_KEY || ''
  }

  const forcedMapping = baseFactoriesMapping?.[`${BASE_FACTORY_CLUSTERSCOPED_BUILTIN_KEY}-${apiVersion}-${resource}`]
  return forcedMapping || BASE_FACTORY_CLUSTERSCOPED_BUILTIN_KEY || ''
}

export const getResourceLinkWithoutName = ({
  clusterName,
  resource,
  apiGroup,
  apiVersion,
  isNamespaced,
  namespace,
  baseFactoriesMapping,
}: {
  clusterName: string
  resource: string
  apiGroup?: string
  apiVersion: string
  isNamespaced?: boolean
  namespace?: string
  baseFactoriesMapping?: Record<string, string> | undefined
}): string => {
  const namespacePrepared = namespace ? `/${namespace}` : `/{reqsJsonPath[0]['.metadata.namespace']['-']}`

  if (apiGroup) {
    return `${BASE_FRONTEND_PREFIX}/${clusterName}${isNamespaced ? namespacePrepared : ''}/factory/${getFactoryKey({
      apiGroup,
      apiVersion,
      resource,
      isNamespaced,
      baseFactoriesMapping,
    })}${apiGroup ? `/${apiGroup}` : ''}/${apiVersion}/${resource}`
  }

  return `${BASE_FRONTEND_PREFIX}/${clusterName}${isNamespaced ? namespacePrepared : ''}/factory/${getFactoryKey({
    apiGroup,
    apiVersion,
    resource,
    isNamespaced,
    baseFactoriesMapping,
  })}${apiGroup ? `/${apiGroup}` : ''}/${apiVersion}/${resource}`
}

export const getNamespaceLink = ({ clusterName }: { clusterName: string }): string => {
  return `${BASE_FRONTEND_PREFIX}/${clusterName}/factory/${BASE_NAMESPACE_FACTORY_KEY}`
}
