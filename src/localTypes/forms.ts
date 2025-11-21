import { TJSON } from './JSON'
import { TFormsOverridesData, TFormsPrefillsData, TFormPrefill } from './formExtensions'
import { TBuiltinResources } from './k8s'

export type TPrepareForm = {
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
  formsOverridesData?: TFormsOverridesData
  formsPrefillsData?: TFormsPrefillsData
  customizationId?: string
  namespacesData?: TBuiltinResources
}

export type TFormName = string | number | string[] | number[] | (string | number)[]
