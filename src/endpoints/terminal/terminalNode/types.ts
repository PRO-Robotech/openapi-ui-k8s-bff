// Note: TProfileType is kept for backwards compatibility with getPodByProfile in utils.ts
// It can be removed once predefined profiles are fully deprecated
export type TProfileType = 'legacy' | 'general' | 'baseline' | 'netadmin' | 'restricted' | 'sysadmin'

// WebSocket message from frontend to terminalNode endpoint
export type TMessage = {
  type: string
  payload: {
    nodeName?: string
    podTemplateName?: string
    podTemplateNamespace?: string
  }
}

export type TContainer = {
  name?: string
  image?: string
} & Record<string, unknown>

export type TPodSpec = {
  containers: TContainer[]
  nodeName?: string
  restartPolicy?: string
} & Record<string, unknown>

export type TPodTemplate = {
  apiVersion?: string
  kind?: string
  metadata?: {
    name?: string
    namespace?: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  template?: {
    metadata?: {
      labels?: Record<string, string>
      annotations?: Record<string, string>
    }
    spec?: TPodSpec
  }
}

export type TValidationResult<T> =
  | {
      success: true
      data: T
    }
  | {
      success: false
      error: string
    }
