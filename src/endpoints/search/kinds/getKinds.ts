import { RequestHandler } from 'express'
import { TKindIndex } from 'src/localTypes/endpoints/kinds'
import { kubeApi } from 'src/constants/httpAgent'
import { TAPIGroupList, TAPIResourceList, TAPIResource } from 'src/localTypes/kinds'
import { TGroupVersionEntry } from './types'
import { groupByKind, groupToVersionEntries, toFlatRecords, toGroupEntries, toItems } from './utils'

export const getKinds: RequestHandler = async (req, res) => {
  try {
    const { data: apiGroupList } = await kubeApi.get<TAPIGroupList>('/apis')
    const groupEntries = toGroupEntries(apiGroupList)
    const groupVersionList = groupEntries.flatMap(groupToVersionEntries)

    const fetchGroupVersion = (
      gv: TGroupVersionEntry,
    ): Promise<{
      group: string
      version: string
      preferred: boolean
      groupVersion: string
      resources: TAPIResource[]
    }> =>
      kubeApi.get<TAPIResourceList>(`/apis/${gv.group}/${gv.version}`).then(({ data }) => ({
        group: gv.group,
        version: gv.version,
        preferred: gv.preferredVersion === gv.version,
        groupVersion: `${gv.group}/${gv.version}`,
        resources: (data?.resources ?? []) as TAPIResource[],
      }))

    const fetchCore = (): Promise<{
      group: string
      version: string
      preferred: boolean
      groupVersion: string
      resources: TAPIResource[]
    }> =>
      kubeApi.get<TAPIResourceList>('/api/v1').then(({ data }) => ({
        group: '',
        version: 'v1',
        preferred: true,
        groupVersion: 'v1',
        resources: (data?.resources ?? []) as TAPIResource[],
      }))

    const entries = await Promise.all([...groupVersionList.map(fetchGroupVersion), fetchCore()])

    const items = await Promise.resolve(entries)
      .then(entries => entries.flatMap(toFlatRecords))
      .then(groupByKind)
      .then(toItems)

    const result: TKindIndex = {
      kind: 'KindIndex',
      apiVersion: 'v1',
      generatedAt: new Date().toISOString(),
      count: items.length,
      items,
    }

    return res.json(result)
  } catch (error) {
    console.error('Error getting kinds:', error)
    return res.status(500).json(error)
  }
}
