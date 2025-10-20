export type TNonEmptyString = string & { __brand: 'NonEmptyString' }

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
