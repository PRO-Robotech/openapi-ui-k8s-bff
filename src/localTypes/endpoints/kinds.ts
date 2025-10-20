export type TVersionEntry = Readonly<{
  version: string
  groupVersion: string
  preferred: boolean
  namespaced: boolean
  resource: string
  verbs?: string[]
}>

export type TKindItem = {
  group: string // "" for core
  kind: string
  versions: TVersionEntry[]
}

export type TKindIndex = {
  kind: 'KindIndex'
  apiVersion: 'v1'
  generatedAt: string
  count: number
  items: TKindItem[]
}
