import { AxiosRequestConfig } from 'axios'
import { userKubeApi } from 'src/constants/httpAgent'
import { TPodTemplate, TContainer, TPodSpec, TValidationResult } from './types'
import { CONTAINER_WAITING } from './constants'

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

export const waitForContainerReady = async ({
  namespace,
  podName,
  containerName,
  maxAttempts = 15,
  retryIntervalMs = 5000,
  headers,
  sendMessage,
}: {
  namespace: string
  podName: string
  containerName: string
  maxAttempts: number
  retryIntervalMs: number
  headers: AxiosRequestConfig['headers']
  sendMessage: (msg: string) => void
}): Promise<boolean> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(
        `[${new Date().toISOString()}]: Websocket: ContainerWaiting: Checking container ${containerName} readiness (attempt ${attempt}/${maxAttempts})`,
      )

      const response = await userKubeApi.get<
        unknown & {
          status: unknown & {
            containerStatuses: {
              name: string
              state?: unknown & { running?: unknown; terminated?: { exitCode?: number } }
            }[]
          }
        }
      >(`/api/v1/namespaces/${namespace}/pods/${podName}`, {
        headers,
      })
      const pod = response.data

      // Find the specific container
      const containerStatus = pod.status?.containerStatuses?.find(status => status.name === containerName)

      if (!containerStatus) {
        console.log(
          `[${new Date().toISOString()}]: Websocket: ContainerWaiting: Container ${containerName} not found in pod status`,
        )
        sendMessage(CONTAINER_WAITING.CONTAINER_NOT_FOUND)
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, retryIntervalMs))
        }
        continue
      }

      if (containerStatus.state?.running) {
        console.log(
          `[${new Date().toISOString()}]: Websocket: ContainerWaiting: Container ${containerName} is ready after ${attempt} attempts`,
        )
        sendMessage(`${CONTAINER_WAITING.CONTAINER_READY} after ${attempt} attempts`)
        return true
      }

      console.log(
        `[${new Date().toISOString()}]: Websocket: ContainerWaiting: Container ${containerName} not ready yet. State:`,
        containerStatus.state ? Object.keys(containerStatus.state)[0] : 'unknown',
      )
      sendMessage(CONTAINER_WAITING.CONTAINER_NOT_READY)

      // Check if container has failed
      if (
        containerStatus.state?.terminated?.exitCode !== undefined &&
        containerStatus.state?.terminated?.exitCode !== 0
      ) {
        sendMessage(`${CONTAINER_WAITING.CONTAINER_TERMINATED} ${containerStatus.state.terminated.exitCode}`)
        throw new Error(
          `Container ${containerName} terminated with exit code ${containerStatus.state.terminated.exitCode}`,
        )
      }

      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, retryIntervalMs))
      } else {
        return false
      }
    } catch (error: any) {
      console.error(
        `[${new Date().toISOString()}]: Websocket: ContainerWaiting: Error checking pod status (attempt ${attempt}/${maxAttempts}):`,
        error.message || {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          error: error,
        },
      )
      // sendError(`Error checking pod status (attempt ${attempt}/${maxAttempts})`)

      // If it's a 404 error, the pod doesn't exist
      // if (error.response?.statusCode === 404) {
      // sendError(`Pod ${podName} not found in namespace ${namespace}`)
      // throw new Error(`Pod ${podName} not found in namespace ${namespace}`)
      // }

      // Continue retrying for other errors until max attempts
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, retryIntervalMs))
      } else {
        return false
      }
    }
  }

  console.error(
    `[${new Date().toISOString()}]: Websocket: ContainerWaiting: Max attempts (${maxAttempts}) reached waiting for container ${containerName} to be ready`,
  )
  return false
  // throw new Error(`Max attempts (${maxAttempts}) reached waiting for container ${containerName} to be ready`)
}
