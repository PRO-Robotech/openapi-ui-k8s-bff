import { AxiosRequestConfig } from 'axios'
import { userKubeApi } from 'src/constants/httpAgent'
import { TProfileType } from './types'
import { CONTAINER_WAITING } from './constants'
import {
  getLegacyPod,
  getGeneralPod,
  getBaselinePod,
  getNetadminPod,
  getRestrictedPod,
  getSysadminPod,
} from './podProfiles'

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

export const getPodByProfile = ({
  namespace,
  podName,
  nodeName,
  containerImage,
  containerName,
  profile,
}: {
  namespace: string
  podName: string
  nodeName: string
  containerImage: string
  containerName: string
  profile: TProfileType
}): Record<string, any> => {
  if (profile === 'legacy') {
    return getLegacyPod({
      namespace,
      podName,
      nodeName,
      containerImage,
      containerName,
    })
  }
  if (profile === 'general') {
    return getGeneralPod({
      namespace,
      podName,
      nodeName,
      containerImage,
      containerName,
    })
  }
  if (profile === 'baseline') {
    return getBaselinePod({
      namespace,
      podName,
      nodeName,
      containerImage,
      containerName,
    })
  }
  if (profile === 'netadmin') {
    return getNetadminPod({
      namespace,
      podName,
      nodeName,
      containerImage,
      containerName,
    })
  }
  if (profile === 'restricted') {
    return getRestrictedPod({
      namespace,
      podName,
      nodeName,
      containerImage,
      containerName,
    })
  }
  if (profile === 'sysadmin') {
    return getSysadminPod({
      namespace,
      podName,
      nodeName,
      containerImage,
      containerName,
    })
  }
  return getBaselinePod({
    namespace,
    podName,
    nodeName,
    containerImage,
    containerName,
  })
}

// export const getPodByProfile = ({
//   namespace,
//   podName,
//   nodeName,
//   containerImage,
//   containerName,
//   profile,
//   randomLetters,
// }: {
//   namespace: string
//   podName: string
//   nodeName: string
//   containerImage: string
//   containerName: string
//   profile: TProfileType
//   randomLetters: string
// }): Record<string, any> => {
//   return {
//     apiVersion: 'v1',
//     kind: 'Pod',
//     metadata: {
//       name: podName,
//       namespace,
//     },
//     spec: {
//       containers: [
//         {
//           image: containerImage,
//           imagePullPolicy: 'IfNotPresent',
//           name: containerName,
//           command: ['sleep'],
//           args: ['infinity'],
//           volumeMounts: [
//             ...(profile === 'legacy' || profile === 'general' || profile === 'sysadmin'
//               ? [
//                   {
//                     mountPath: '/host',
//                     name: 'host-root',
//                   },
//                 ]
//               : []),
//             {
//               mountPath: '/var/run/secrets/kubernetes.io/serviceaccount',
//               name: `kube-api-access-${randomLetters}`,
//               readOnly: true,
//             },
//           ],
//         },
//       ],
//       nodeName,
//       restartPolicy: 'Never',
//       schedulerName: 'default-scheduler',
//       volumes: [
//         ...(profile === 'legacy' || profile === 'general' || profile === 'sysadmin'
//           ? [
//               {
//                 hostPath: {
//                   path: '/',
//                   type: '',
//                 },
//                 name: 'host-root',
//               },
//             ]
//           : []),
//         {
//           name: `kube-api-access-${randomLetters}`,
//           projected: {
//             defaultMode: 420,
//             sources: [
//               {
//                 serviceAccountToken: {
//                   expirationSeconds: 3607,
//                   path: 'token',
//                 },
//               },
//               {
//                 configMap: {
//                   items: [
//                     {
//                       key: 'ca.crt',
//                       path: 'ca.crt',
//                     },
//                   ],
//                   name: 'kube-root-ca.crt',
//                 },
//               },
//               {
//                 downwardAPI: {
//                   items: [
//                     {
//                       fieldRef: {
//                         apiVersion: 'v1',
//                         fieldPath: 'metadata.namespace',
//                       },
//                       path: 'namespace',
//                     },
//                   ],
//                 },
//               },
//             ],
//           },
//         },
//       ],
//       ...(profile === 'restricted'
//         ? {
//             securityContext: {
//               allowPrivilegeEscalation: false,
//               capabilities: {
//                 drop: ['ALL'],
//               },
//               runAsNonRoot: true,
//               seccompProfile: {
//                 type: 'RuntimeDefault',
//               },
//             },
//           }
//         : {}),
//       ...(profile === 'netadmin'
//         ? {
//             securityContext: {
//               capabilities: {
//                 add: ['NET_ADMIN', 'NET_RAW'],
//               },
//             },
//           }
//         : {}),
//       ...(profile === 'sysadmin'
//         ? {
//             securityContext: {
//               privileged: true,
//             },
//           }
//         : {}),
//     },
//     ...(profile === 'legacy' || profile === 'general' || profile === 'sysadmin' || profile === 'netadmin'
//       ? {
//           hostIPC: true,
//           hostNetwork: true,
//           hostPID: true,
//         }
//       : {}),
//   }
// }

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
