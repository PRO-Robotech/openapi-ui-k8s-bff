export type TFormPrefill = {
  spec: {
    customizationId: string
    values: {
      path: (string | number)[]
      value: unknown
    }[]
  }
}

export type TFormsPrefillsData = {
  items: TFormPrefill[]
}

export type TFormOverride = {
  spec: {
    customizationId: string
    strategy: string
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
