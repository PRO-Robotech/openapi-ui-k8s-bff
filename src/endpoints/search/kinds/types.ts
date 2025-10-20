export type TNonEmptyString = string & { __brand: 'NonEmptyString' }

// ---------- Kubernetes API types ----------

export type TGroupVersionForDiscovery = {
  groupVersion: string // e.g., "apps/v1"
  version: string // e.g., "v1"
}

export type TAPIGroup = {
  name: string // e.g., "apps"
  versions: TGroupVersionForDiscovery[]
  preferredVersion?: TGroupVersionForDiscovery
}

export type TAPIGroupList = {
  kind: 'APIGroupList'
  apiVersion: 'v1'
  groups: TAPIGroup[]
}

export type TAPIResource = {
  name: string // e.g., "deployments" or "deployments/status"
  singularName: string
  namespaced: boolean
  kind: string // e.g., "Deployment"
  verbs?: string[]
  shortNames?: readonly string[]
  categories?: readonly string[]
  group?: string
  version?: string
  storageVersionHash?: string
}

export type TAPIResourceList = {
  kind: 'APIResourceList'
  apiVersion: 'v1'
  groupVersion: string // e.g., "apps/v1"
  resources: TAPIResource[]
}

// utils

export type TGroupVersionEntry = {
  group: string
  version: string
  preferredVersion: string | null
}

export type TFlatRecord = {
  key: string // `${group}|${kind}`
  value: {
    group: string
    kind: string
    version: string
    groupVersion: string
    preferred: boolean
    namespaced: boolean
    resource: string
    verbs?: string[]
  }
}
