export const checkIfApiInstanceNamespaceScoped = ({
  typeName,
  apiGroup,
  apiVersion,
  swaggerPaths,
}: {
  typeName: string
  apiGroup: string
  apiVersion: string
  swaggerPaths: string[]
}): { isClusterWide: boolean; isNamespaceScoped: boolean } => {
  const url = `/apis/${apiGroup}/${apiVersion}/${typeName}`
  const nsUrl = `/apis/${apiGroup}/${apiVersion}/namespaces/{namespace}/${typeName}`
  const isClusterWide = swaggerPaths.includes(url)
  const isNamespaceScoped = swaggerPaths.includes(nsUrl)

  return { isClusterWide, isNamespaceScoped }
}

export const checkIfBuiltInInstanceNamespaceScoped = ({
  typeName,
  swaggerPaths,
}: {
  typeName: string
  swaggerPaths: string[]
}): { isClusterWide: boolean; isNamespaceScoped: boolean } => {
  const url = `/api/v1/${typeName}`
  const nsUrl = `/api/v1/namespaces/{namespace}/${typeName}`
  const isClusterWide = swaggerPaths.includes(url)
  const isNamespaceScoped = swaggerPaths.includes(nsUrl)

  return { isClusterWide, isNamespaceScoped }
}
