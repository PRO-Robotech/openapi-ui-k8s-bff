import { THeaders } from './common'
import { TJSON } from '../JSON'
import { TFormPrefill } from '../formExtensions'
import { TFormName } from '../forms'
import { TFormSchemaProperties } from '../formSchema'

export type TPrepareFormReq = {
  body: {
    data:
      | {
          type: 'builtin'
          plural: string
          prefillValuesSchema?: TJSON
          prefillValueNamespaceOnly?: string
        }
      | {
          type: 'apis'
          apiGroup: string
          apiVersion: string
          plural: string
          prefillValuesSchema?: TJSON
          prefillValueNamespaceOnly?: string
        }
    cluster: string
    partsOfUrl: string[]
    customizationId?: string
    customizationIdPrefill?: string
  }
} & THeaders

export type TPrepareFormRes =
  | {
      result: 'error'
      error: string | undefined
      kind: string | undefined
      fallbackToManualMode: true
      isNamespaced: boolean
    }
  | {
      result: 'success'
      properties: TFormSchemaProperties
      required: string[] | undefined
      hiddenPaths: string[][] | undefined
      expandedPaths: string[][] | undefined
      persistedPaths: TFormName[] | undefined
      sortPaths: string[][] | undefined
      forceViewMode?: 'OpenAPI' | 'Manual'
      kind: string | undefined
      isNamespaced: boolean
      formPrefills?: TFormPrefill
      namespacesData?: string[]
    }

export type TYamlByValuesReq = {
  body: {
    values: any
    persistedKeys: TFormName[]
    properties: TFormSchemaProperties
  }
} & THeaders

export type TYamlByValuesRes = any

export type TValuesByYamlReq = {
  body: {
    values: Record<string, unknown>
    properties: TFormSchemaProperties
  }
} & THeaders

export type TValuesByYamlRes = any
