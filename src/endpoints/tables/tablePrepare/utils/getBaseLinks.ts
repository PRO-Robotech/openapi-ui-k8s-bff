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
  plural,
  isNamespaced,
  baseFactoriesMapping,
}: {
  plural: string
  apiGroup?: string
  apiVersion: string
  isNamespaced?: boolean
  baseFactoriesMapping?: Record<string, string> | undefined
}): string => {
  if (isNamespaced) {
    if (apiGroup) {
      const forcedMapping =
        baseFactoriesMapping?.[`${BASE_FACTORY_NAMESPACED_API_KEY}-${apiGroup}-${apiVersion}-${plural}`]
      return forcedMapping || BASE_FACTORY_NAMESPACED_API_KEY || ''
    }

    const forcedMapping = baseFactoriesMapping?.[`${BASE_FACTORY_NAMESPACED_BUILTIN_KEY}-${apiVersion}-${plural}`]
    return forcedMapping || BASE_FACTORY_NAMESPACED_BUILTIN_KEY || ''
  }

  if (apiGroup) {
    const forcedMapping =
      baseFactoriesMapping?.[`${BASE_FACTORY_CLUSTERSCOPED_API_KEY}-${apiGroup}-${apiVersion}-${plural}`]
    return forcedMapping || BASE_FACTORY_CLUSTERSCOPED_API_KEY || ''
  }

  const forcedMapping = baseFactoriesMapping?.[`${BASE_FACTORY_CLUSTERSCOPED_BUILTIN_KEY}-${apiVersion}-${plural}`]
  return forcedMapping || BASE_FACTORY_CLUSTERSCOPED_BUILTIN_KEY || ''
}

export const getResourceLinkWithoutName = ({
  cluster,
  plural,
  apiGroup,
  apiVersion,
  isNamespaced,
  namespace,
  baseFactoriesMapping,
}: {
  cluster: string
  plural: string
  apiGroup?: string
  apiVersion: string
  isNamespaced?: boolean
  namespace?: string
  baseFactoriesMapping?: Record<string, string> | undefined
}): string => {
  const namespacePrepared = namespace ? `/${namespace}` : `/{reqsJsonPath[0]['.metadata.namespace']['-']}`

  if (apiGroup) {
    return `${BASE_FRONTEND_PREFIX}/${cluster}${isNamespaced ? namespacePrepared : ''}/factory/${getFactoryKey({
      apiGroup,
      apiVersion,
      plural,
      isNamespaced,
      baseFactoriesMapping,
    })}${apiGroup ? `/${apiGroup}` : ''}/${apiVersion}/${plural}`
  }

  return `${BASE_FRONTEND_PREFIX}/${cluster}${isNamespaced ? namespacePrepared : ''}/factory/${getFactoryKey({
    apiGroup,
    apiVersion,
    plural,
    isNamespaced,
    baseFactoriesMapping,
  })}${apiGroup ? `/${apiGroup}` : ''}/${apiVersion}/${plural}`
}

export const getNamespaceLink = ({ cluster }: { cluster: string }): string => {
  return `${BASE_FRONTEND_PREFIX}/${cluster}/factory/${BASE_NAMESPACE_FACTORY_KEY}`
}
