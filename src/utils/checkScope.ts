export const checkIfApiInstanceNamespaceScoped = ({
  plural,
  apiGroup,
  apiVersion,
  swaggerPaths,
}: {
  plural: string
  apiGroup: string
  apiVersion: string
  swaggerPaths: string[]
}): { isClusterWide: boolean; isNamespaceScoped: boolean } => {
  const url = `/apis/${apiGroup}/${apiVersion}/${plural}`
  const nsUrl = `/apis/${apiGroup}/${apiVersion}/namespaces/{namespace}/${plural}`
  const isClusterWide = swaggerPaths.includes(url)
  const isNamespaceScoped = swaggerPaths.includes(nsUrl)

  return { isClusterWide, isNamespaceScoped }
}

export const checkIfBuiltInInstanceNamespaceScoped = ({
  plural,
  swaggerPaths,
}: {
  plural: string
  swaggerPaths: string[]
}): { isClusterWide: boolean; isNamespaceScoped: boolean } => {
  const url = `/api/v1/${plural}`
  const nsUrl = `/api/v1/namespaces/{namespace}/${plural}`
  const isClusterWide = swaggerPaths.includes(url)
  const isNamespaceScoped = swaggerPaths.includes(nsUrl)

  return { isClusterWide, isNamespaceScoped }
}
