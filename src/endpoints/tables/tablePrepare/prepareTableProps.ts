import { RequestHandler } from 'express'
import _ from 'lodash'
import { TPrepareTableReq, TPrepareTableRes } from 'src/localTypes/endpoints/tables'
import { TAPIResourceList, TAPIResource } from 'src/localTypes/kinds'
import { TTableMappingResponse } from 'src/localTypes/tableExtensions'
import { TApiResources } from 'src/localTypes/k8s'
import { DEVELOPMENT, BASE_API_GROUP, BASE_API_VERSION } from 'src/constants/envs'
import { userKubeApi, kubeApi } from 'src/constants/httpAgent'
import { parseColumnsOverrides } from './utils/parseColumnsOverrides'
import { prepareTableMappings } from './utils/prepareTableMappings'
import { getResourceLinkWithoutName, getNamespaceLink } from './utils/getBaseLinks'
import { getDefaultAdditionalPrinterColumns } from './utils/getDefaultAdditionalPrinterColumns'
import { prepareKeyTypeProps } from './utils/prepareKeyTypeProps'

export const prepareTableProps: RequestHandler = async (req: TPrepareTableReq, res) => {
  try {
    const filteredHeaders = { ...req.headers }
    delete filteredHeaders['host'] // Avoid passing internal host header
    delete filteredHeaders['content-length'] // This header causes "stream has been aborted"

    const { data: customcolumnsoverrides } = await userKubeApi.get<TApiResources>(
      `/apis/${BASE_API_GROUP}/${BASE_API_VERSION}/customcolumnsoverrides`,
      {
        headers: {
          ...(DEVELOPMENT ? {} : filteredHeaders),
          'Content-Type': 'application/json',
        },
      },
    )

    const {
      ensuredCustomOverrides,
      ensuredCustomOverridesUndefinedValues,
      ensuredCustomOverridesTrimLengths,
      ensuredCustomOverridesColWidths,
      ensuredCustomOverridesKeyTypeProps,
    } = parseColumnsOverrides({
      columnsOverridesData: customcolumnsoverrides,
      customizationId: req.body.customizationId,
    })

    let isNamespaced = false
    let kind: string | undefined
    if (req.body.k8sResource?.apiGroup) {
      const { data: apiResourceList } = await kubeApi.get<TAPIResourceList>(
        `/apis/${req.body.k8sResource.apiGroup}/${req.body.k8sResource.apiVersion}`,
      )
      const specificResource: TAPIResource | undefined = apiResourceList.resources.find(
        ({ name }) => name === req.body.k8sResource?.resource,
      )
      if (specificResource?.namespaced) {
        isNamespaced = true
      }
      kind = specificResource?.kind
    } else if (req.body.k8sResource?.resource) {
      const { data: apiResourceList } = await kubeApi.get<TAPIResourceList>(`/api/${req.body.k8sResource.apiVersion}`)
      const specificResource: TAPIResource | undefined = apiResourceList.resources.find(
        ({ name }) => name === req.body.k8sResource?.resource,
      )
      if (specificResource?.namespaced) {
        isNamespaced = true
      }
      kind = specificResource?.kind
    }

    const namespaceScopedWithoutNamespace = isNamespaced && !req.body.namespace
    const basePrefixLinkWithoutName = req.body.k8sResource
      ? getResourceLinkWithoutName({
          resource: req.body.k8sResource.resource,
          apiGroup: req.body.k8sResource.apiGroup,
          apiVersion: req.body.k8sResource.apiVersion,
          isNamespaced,
          namespace: req.body.namespace,
        })
      : undefined
    const namespaceLinkWithoutName = getNamespaceLink()

    // console.log(`resource: ${req.body.k8sResource?.resource} | namespaced: ${isNamespaced}`)
    // console.log(`resource: ${req.body.k8sResource?.resource} | basePrefixLinkWithoutName: ${basePrefixLinkWithoutName}`)

    const additionalPrinterColumns = getDefaultAdditionalPrinterColumns({
      forceDefaultAdditionalPrinterColumns: req.body.forceDefaultAdditionalPrinterColumns,
      namespaceScopedWithoutNamespace,
    })

    const { data: tableurimappings } = await userKubeApi.get<TTableMappingResponse>(
      `/apis/${BASE_API_GROUP}/${BASE_API_VERSION}/tableurimappings`,
      {
        headers: {
          ...(DEVELOPMENT ? {} : filteredHeaders),
          'Content-Type': 'application/json',
        },
      },
    )

    const tableMappingsDataSpecs = tableurimappings.items.map(({ spec }) => spec)

    const tableMappingSpecific =
      tableMappingsDataSpecs.length > 0 && req.body.customizationId && req.body.tableMappingsReplaceValues
        ? prepareTableMappings({
            data: tableMappingsDataSpecs,
            customizationId: req.body.customizationId,
            replaceValues: req.body.tableMappingsReplaceValues,
          })
        : undefined

    const result: TPrepareTableRes = {
      additionalPrinterColumns: ensuredCustomOverrides || additionalPrinterColumns,
      additionalPrinterColumnsUndefinedValues: [
        { key: 'Namespace', value: '-' },
        ...(ensuredCustomOverridesUndefinedValues || []),
      ],
      additionalPrinterColumnsTrimLengths: [{ key: 'Name', value: 64 }, ...(ensuredCustomOverridesTrimLengths || [])],
      additionalPrinterColumnsColWidths: ensuredCustomOverridesColWidths,
      additionalPrinterColumnsKeyTypeProps: prepareKeyTypeProps({
        ensuredCustomOverridesKeyTypeProps,
        namespaceScopedWithoutNamespace,
        kind,
        basePrefixLinkWithoutName,
        namespaceLinkWithoutName,
      }),

      pathToNavigate: tableMappingSpecific?.pathToNavigate,
      recordKeysForNavigation: tableMappingSpecific?.keysToParse,
      recordKeysForNavigationSecond: tableMappingSpecific?.keysToParseSecond,
      recordKeysForNavigationThird: tableMappingSpecific?.keysToParseThird,
    }

    res.json(result)
  } catch (error) {
    console.error('[prepareTableProps] Error:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error: error,
      body: req.body,
    })

    const errorResponse = {
      error: error instanceof Error ? error.message : String(error),
      ...(process.env.DEVELOPMENT === 'TRUE' && error instanceof Error ? { stack: error.stack } : {}),
    }
    res.status(500).json(errorResponse)
  }
}
