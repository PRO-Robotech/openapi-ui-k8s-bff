import { THeaders } from './common'
import {
  TAdditionalPrinterColumns,
  TAdditionalPrinterColumnsUndefinedValues,
  TAdditionalPrinterColumnsTrimLengths,
  TAdditionalPrinterColumnsColWidths,
  TAdditionalPrinterColumnsKeyTypeProps,
} from '../tableExtensions'

export type TPrepareTableReq = {
  body: {
    customizationId?: string
    tableMappingsReplaceValues?: Record<string, string | undefined>
    forceDefaultAdditionalPrinterColumns?: TAdditionalPrinterColumns
    cluster: string
    namespace?: string
    k8sResource?: {
      plural: string
      apiGroup?: string
      apiVersion: string
    }
    // namespaceScopedWithoutNamespace?: boolean
  }
} & THeaders

export type TPrepareTableRes = {
  additionalPrinterColumns: TAdditionalPrinterColumns
  additionalPrinterColumnsUndefinedValues?: TAdditionalPrinterColumnsUndefinedValues
  additionalPrinterColumnsTrimLengths?: TAdditionalPrinterColumnsTrimLengths
  additionalPrinterColumnsColWidths?: TAdditionalPrinterColumnsColWidths
  additionalPrinterColumnsKeyTypeProps?: TAdditionalPrinterColumnsKeyTypeProps

  pathToNavigate?: string
  recordKeysForNavigation?: string | string[] // jsonpath or keys as string[]
  recordKeysForNavigationSecond?: string | string[] // jsonpath or keys as string[]
  recordKeysForNavigationThird?: string | string[] // jsonpath or keys as string[]
}
