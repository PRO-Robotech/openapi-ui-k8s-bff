/* eslint-disable no-use-before-define */
export type TFormSchemaKnownType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'array'
  | 'object'
  | 'listInput'
  | 'multilineString'
  | 'multilineStringBase64'
  | 'rangeInputCpu'
  | 'rangeInputMemory'

type TFormSchemaLooseType = TFormSchemaKnownType | (string & {})

/**
 * Normalized form-schema node produced by the BFF and consumed by the form UI.
 * It intentionally models only the subset of schema keywords the form stack
 * understands today, plus project-specific extensions used by overrides.
 */
export interface TFormSchemaNode {
  type?: TFormSchemaLooseType | TFormSchemaLooseType[]
  properties?: TFormSchemaProperties
  items?: TFormSchemaNode
  additionalProperties?: boolean | TFormSchemaNode
  required?: string[]
  enum?: string[]
  default?: unknown
  description?: string
  customProps?: unknown
  isAdditionalProperties?: boolean
  'x-kubernetes-preserve-unknown-fields'?: boolean
  'x-kubernetes-int-or-string'?: boolean
}

export interface TFormSchemaProperties {
  [name: string]: TFormSchemaNode
}
