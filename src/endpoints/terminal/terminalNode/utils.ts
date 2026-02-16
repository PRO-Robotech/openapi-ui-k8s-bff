import { AxiosRequestConfig } from 'axios'
import { userKubeApi } from 'src/constants/httpAgent'
import { TPodTemplate, TContainer, TPodSpec, TValidationResult } from './types'
import { POD_WAITING } from './constants'

const isObjectRecord = (v: unknown): v is Record<string, unknown> => {
  return typeof v === 'object' && v !== null
}

export const isTContainer = (v: unknown): v is TContainer => {
  if (!isObjectRecord(v)) {
    return false
  }

  const name = v['name']
  if (name !== undefined && typeof name !== 'string') {
    return false
  }

  const image = v['image']
  if (image !== undefined && typeof image !== 'string') {
    return false
  }

  return true
}

export const isTPodSpec = (v: unknown): v is TPodSpec => {
  if (!isObjectRecord(v)) {
    return false
  }

  const containers = v['containers']
  if (!Array.isArray(containers)) {
    return false
  }
  if (!containers.every(isTContainer)) {
    return false
  }

  const nodeName = v['nodeName']
  if (nodeName !== undefined && typeof nodeName !== 'string') {
    return false
  }

  const restartPolicy = v['restartPolicy']
  if (restartPolicy !== undefined && typeof restartPolicy !== 'string') {
    return false
  }

  return true
}

const validatePodTemplateSpec = (spec: unknown): TValidationResult<TPodSpec> => {
  if (isTPodSpec(spec)) {
    return { success: true, data: spec }
  }

  return { success: false, error: 'Spec in invalid' }
}

export const generateRandomLetters = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz'
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export const getNamespaceBody = ({ namespaceName }: { namespaceName: string }): Record<string, any> => {
  return {
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: {
      name: namespaceName,
    },
  }
}

export const getPodFromPodTemplate = ({
  podTemplate,
  namespace,
  podName,
  nodeName,
}: {
  podTemplate: TPodTemplate
  namespace: string
  podName: string
  nodeName: string
}): TValidationResult<Record<string, unknown>> => {
  const specFromTemplate = podTemplate?.template?.spec

  const specValidation = validatePodTemplateSpec(specFromTemplate)
  if (!specValidation.success) {
    return specValidation
  }

  const templateMeta = podTemplate?.template?.metadata ?? {}
  const podSpec: TPodSpec = { ...specValidation.data }

  podSpec.nodeName = nodeName

  if (!podSpec.restartPolicy) {
    podSpec.restartPolicy = 'Never'
  }

  delete podSpec.hostname

  return {
    success: true,
    data: {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: {
        name: podName,
        namespace,
        ...(templateMeta.labels ? { labels: templateMeta.labels } : {}),
        ...(templateMeta.annotations ? { annotations: templateMeta.annotations } : {}),
      },
      spec: podSpec,
    },
  }
}

export const waitForPodRunning = async ({
  namespace,
  podName,
  maxAttempts = 25,
  retryIntervalMs = 5000,
  headers,
  sendMessage,
}: {
  namespace: string
  podName: string
  maxAttempts?: number
  retryIntervalMs?: number
  headers: AxiosRequestConfig['headers']
  sendMessage: (msg: string) => void
}): Promise<boolean> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(
        `[${new Date().toISOString()}]: Websocket: PodWaiting: Checking pod phase (attempt ${attempt}/${maxAttempts})`,
      )

      const response = await userKubeApi.get<{
        status?: {
          phase?: string
        }
      }>(`/api/v1/namespaces/${namespace}/pods/${podName}`, {
        headers,
      })

      const podPhase = response.data?.status?.phase

      console.log(`[${new Date().toISOString()}]: Websocket: PodWaiting: Pod phase: ${podPhase}`)

      if (podPhase === 'Running') {
        sendMessage(`${POD_WAITING.POD_RUNNING} after ${attempt} attempts`)
        return true
      }

      if (podPhase === 'Failed') {
        sendMessage(POD_WAITING.POD_FAILED)
        return false
      }

      if (podPhase === 'Unknown') {
        sendMessage(POD_WAITING.POD_UNKNOWN)
      } else {
        sendMessage(`${POD_WAITING.POD_PENDING}: ${podPhase}`)
      }

      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, retryIntervalMs))
      } else {
        return false
      }
    } catch (error: unknown) {
      console.error(
        `[${new Date().toISOString()}]: Websocket: PodWaiting: Error checking pod status (attempt ${attempt}/${maxAttempts}):`,
        error instanceof Error ? error.message : String(error),
      )

      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, retryIntervalMs))
      } else {
        return false
      }
    }
  }

  console.error(
    `[${new Date().toISOString()}]: Websocket: PodWaiting: Max attempts (${maxAttempts}) reached waiting for pod to be running`,
  )
  return false
}
