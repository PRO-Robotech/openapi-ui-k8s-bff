import { TAPIGroup, TAPIGroupList, TAPIResource, TFlatRecord } from './types'
import { TVersionEntry, TKindItem } from 'src/localTypes/endpoints/kinds'

export const toGroupEntries = (groupsList?: TAPIGroupList): TAPIGroup[] => {
  return groupsList?.groups ?? []
}

export const groupToVersionEntries = (
  g: TAPIGroup,
): {
  group: string
  version: string
  preferredVersion: string | null
}[] => {
  return (g.versions ?? []).map(v => ({
    group: g.name,
    version: v.version,
    preferredVersion: g.preferredVersion?.version ?? null,
  }))
}

const isTopLevelResource = (r: TAPIResource): boolean =>
  Boolean(r?.kind) && typeof r.name === 'string' && !r.name.includes('/')

export const toFlatRecords = (entry: {
  group: string
  version: string
  preferred: boolean
  groupVersion: string
  resources: TAPIResource[]
}): TFlatRecord[] =>
  entry.resources.filter(isTopLevelResource).map(
    (r): TFlatRecord => ({
      key: `${entry.group}|${r.kind}`,
      value: {
        group: entry.group,
        kind: r.kind,
        version: entry.version,
        groupVersion: entry.group === '' ? 'v1' : `${entry.group}/${entry.version}`,
        preferred: entry.preferred,
        namespaced: r.namespaced,
        resource: r.name,
        verbs: r.verbs,
      },
    }),
  )

export const groupByKind = (records: TFlatRecord[]): Record<string, TFlatRecord['value'][]> =>
  records.reduce<Record<string, TFlatRecord['value'][]>>(
    (acc, { key, value }) => ({
      ...acc,
      [key]: [...((acc as Record<string, TFlatRecord['value'][]>)[key] ?? []), value],
    }),
    {},
  )

const sortVersions = (a: TVersionEntry, b: TVersionEntry): number =>
  a.preferred === b.preferred ? a.version.localeCompare(b.version) : a.preferred ? -1 : 1

export const toItems = (grouped: Readonly<Record<string, TFlatRecord['value'][]>>): TKindItem[] =>
  Object.entries(grouped)
    .map<TKindItem>(([key, versions]) => {
      const [group, kind] = key.split('|')
      const entries: TVersionEntry[] = [...versions]
        .map(
          (v): TVersionEntry =>
            ({
              version: v.version,
              groupVersion: v.groupVersion,
              preferred: v.preferred,
              namespaced: v.namespaced,
              resource: v.resource,
              verbs: v.verbs,
            }) as const,
        )
        .sort(sortVersions)
      return { group, kind, versions: entries } as const
    })
    .sort((a, b) => (a.kind === b.kind ? (a.group || '').localeCompare(b.group || '') : a.kind.localeCompare(b.kind)))
