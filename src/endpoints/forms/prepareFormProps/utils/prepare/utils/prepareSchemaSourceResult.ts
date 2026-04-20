import { TPrepareForm } from 'src/localTypes/forms'
import { TFormSchemaNode } from 'src/localTypes/formSchema'
import { TV3SchemaSupportIssue } from './checkV3SchemaSupport'

export type TPrepareSchemaSource = 'v2' | 'v3'

export type TPrepareSchemaSourceData = TPrepareForm['data']

type TPrepareSchemaSourceBase = {
  source: TPrepareSchemaSource
  isNamespaced: boolean
  kind?: string
}

export type TPrepareSchemaSourceSuccessResult = TPrepareSchemaSourceBase & {
  status: 'success'
  bodyParametersSchema: TFormSchemaNode
}

export type TPrepareSchemaSourceUnsupportedResult = TPrepareSchemaSourceBase & {
  status: 'unsupported'
  error: string
  issues: TV3SchemaSupportIssue[]
}

export type TPrepareSchemaSourceErrorResult = TPrepareSchemaSourceBase & {
  status: 'error'
  error: string
}

export type TPrepareSchemaSourceUnavailableResult = {
  source: TPrepareSchemaSource
  status: 'unavailable'
  error?: string
}

export type TPrepareSchemaSourceResult =
  | TPrepareSchemaSourceSuccessResult
  | TPrepareSchemaSourceUnsupportedResult
  | TPrepareSchemaSourceErrorResult
  | TPrepareSchemaSourceUnavailableResult
