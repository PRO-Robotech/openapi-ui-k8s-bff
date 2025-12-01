export type TAdditionalPrinterColumns = {
  name: string
  jsonPath?: string
  type?: string
  customProps?: unknown
}[]

export type TAdditionalPrinterColumnsUndefinedValues = {
  key: string
  value: string
}[]

export type TAdditionalPrinterColumnsTrimLengths = {
  key: string
  value: number
}[]

export type TAdditionalPrinterColumnsColWidths = {
  key: string
  value: string
}[]

export type TAdditionalPrinterColumnsKeyTypeProps = Record<
  string,
  {
    type: string
    customProps?: unknown
  }
>

export type TAdditionalPrinterColumnsDisableSortersAndFilters = string[] // React.Key

export type TTableMappingData = {
  id: string
  pathToNavigate: string
  keysToParse: string | string[] // jsonpath or keys as string[]
  // pathToNavigateSecond: string
  keysToParseSecond: string | string[] // jsonpath or keys as string[]
  keysToParseThird: string | string[] // jsonpath or keys as string[]
}

export type TTableMappingResource = {
  apiVersion: string
  kind: string
  spec: TTableMappingData
} & unknown

export type TTableMappingResponse = {
  apiVersion: string
  items: TTableMappingResource[]
}
