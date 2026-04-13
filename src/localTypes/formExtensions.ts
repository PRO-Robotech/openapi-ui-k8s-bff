export type TFormPrefillPathSeg = string | number

export type TFormPrefillValueEntry = {
  path: TFormPrefillPathSeg[]
  value: unknown
}

export type TFormPrefillValuesObject = Record<string, unknown> | unknown[]

// Raw CR shape (input from k8s): supports both legacy canonical array and new object-style values.
export type TFormPrefillRaw = {
  spec: {
    customizationId: string
    values: TFormPrefillValueEntry[] | TFormPrefillValuesObject
  }
}

// Canonical runtime shape used by consumers.
export type TFormPrefill = {
  spec: {
    customizationId: string
    values: TFormPrefillValueEntry[]
  }
}

export type TFormsPrefillsData = {
  items: TFormPrefillRaw[]
}

export type TFormOverride = {
  spec: {
    customizationId: string
    strategy: string
    forceViewMode?: 'OpenAPI' | 'Manual'
    schema: {
      properties: Record<string, unknown>
      required?: string[]
    }
    hidden?: string[][]
    expanded?: string[][]
    persisted?: string[][]
    sort?: string[][]
  }
}

export type TFormsOverridesData = {
  items: (TFormOverride & unknown)[]
}
