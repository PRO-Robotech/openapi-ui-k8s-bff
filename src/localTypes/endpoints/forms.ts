import { OpenAPIV2 } from 'openapi-types'
import { THeaders } from './common'
import { TJSON } from '../JSON'
import { TFormPrefill } from '../formExtensions'
import { TFormName } from '../forms'

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
    customizationId?: string
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
      properties: {
        [name: string]: OpenAPIV2.SchemaObject
      }
      required: string[] | undefined
      hiddenPaths: string[][] | undefined
      expandedPaths: string[][] | undefined
      persistedPaths: string[][] | undefined
      sortPaths: string[][] | undefined
      kind: string | undefined
      isNamespaced: boolean
      formPrefills?: TFormPrefill
      namespacesData?: string[]
    }

export type TYamlByValuesReq = {
  body: {
    values: any
    persistedKeys: TFormName[]
    properties: OpenAPIV2.SchemaObject['properties']
  }
} & THeaders

export type TYamlByValuesRes = any

export type TValuesByYamlReq = {
  body: {
    values: Record<string, unknown>
    properties: OpenAPIV2.SchemaObject['properties']
  }
} & THeaders

export type TValuesByYamlRes = any
