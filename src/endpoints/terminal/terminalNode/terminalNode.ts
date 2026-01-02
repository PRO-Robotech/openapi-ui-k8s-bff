/* eslint-disable max-lines-per-function */
import { WebsocketRequestHandler } from 'express-ws'
import { DEVELOPMENT } from 'src/constants/envs'
import { userKubeApi } from 'src/constants/httpAgent'
import { filterHeadersFromEnv } from 'src/utils/filterHeadersFromEnv'
import { generateRandomLetters, getNamespaceBody, getPodFromPodTemplate, waitForPodRunning } from './utils'
import { SHUTDOWN_MESSAGES, WARMUP_MESSAGES } from './constants'
import { TPodTemplate, TMessage } from './types'

export const terminalNodeWebSocket: WebsocketRequestHandler = async (ws, req) => {
  console.log(`[${new Date().toISOString()}]: Websocket: Client connected to WebSocket server`)

  const filteredHeaders = filterHeadersFromEnv(req)

  try {
    const handleInit = async (message: TMessage) => {
      if (message.type !== 'init') {
        console.error(
          `[${new Date().toISOString()}]: Websocket: HandleInit: First message must be init, but got type: ${
            message.type
          }`,
        )
        ws.close()
        return
      }

      const { nodeName, podTemplateName, podTemplateNamespace } = message.payload

      if (!nodeName) {
        console.error(`[${new Date().toISOString()}]: Websocket: HandleInit: nodeName is required`)
        ws.close()
        return
      }

      const randomLetters = generateRandomLetters()
      const namespaceName = `debugger-${nodeName}-bff-${randomLetters}`
      const podName = `debugger-${nodeName}-bff-${randomLetters}`

      const cleanUp = async () => {
        try {
          // STAGE III: deleting pod then namespace
          /*
          shutdown: SHUTDOWN_MESSAGES.SHUTDOWN
          shutdown: SHUTDOWN_MESSAGES.POD_DELETED || shutdown: SHUTDOWN_MESSAGES.POD_DELETE_ERROR
          shutdown: SHUTDOWN_MESSAGES.NAMESPACE_DELETED || shutdown: SHUTDOWN_MESSAGES.NAMESPACE_DELETE_ERROR
        */
          ws.send(JSON.stringify({ type: 'shutdown', payload: SHUTDOWN_MESSAGES.SHUTDOWN }))
          console.log(`[${new Date().toISOString()}]: Websocket: onClose: Deleting pod then namespace`)
          return await userKubeApi
            .delete(`/api/v1/namespaces/${namespaceName}/pods/${podName}`, {
              headers: {
                ...(DEVELOPMENT ? {} : filteredHeaders),
                'Content-Type': 'application/json',
              },
            })
            .then(() => {
              console.log(`[${new Date().toISOString()}]: Websocket: onClose: Pod deleted`)
              ws.send(JSON.stringify({ type: 'shutdown', payload: SHUTDOWN_MESSAGES.POD_DELETED }))
              userKubeApi
                .delete(`/api/v1/namespaces/${namespaceName}`, {
                  headers: {
                    ...(DEVELOPMENT ? {} : filteredHeaders),
                    'Content-Type': 'application/json',
                  },
                })
                .then(() => {
                  console.log(`[${new Date().toISOString()}]: Websocket: onClose: Namespace deleted`)
                  ws.send(JSON.stringify({ type: 'shutdown', payload: SHUTDOWN_MESSAGES.NAMESPACE_DELETED }))
                  return true
                })
                .catch(error => {
                  console.error(`[${new Date().toISOString()}]: Websocket: onClose: Namespace not deleted: ${error}`)
                  ws.send(JSON.stringify({ type: 'shutdown', payload: SHUTDOWN_MESSAGES.NAMESPACE_DELETE_ERROR }))
                  return false
                })
            })
            .catch(error => {
              console.error(`[${new Date().toISOString()}]: Websocket: onClose: Pod not deleted: ${error}`)
              ws.send(JSON.stringify({ type: 'shutdown', payload: SHUTDOWN_MESSAGES.POD_DELETE_ERROR }))
            })
            .finally(() => {
              console.log(`[${new Date().toISOString()}]: Websocket: Client disconnected`)
            })
        } catch (error) {
          console.error(`[${new Date().toISOString()}]: Websocket: onClose: Critical: Clean up failed: ${error}`)
          ws.send(JSON.stringify({ type: 'shutdown', payload: SHUTDOWN_MESSAGES.CRITICAL }))
        }
      }

      // STAGE I: warmup
      /*
        warmup: NAMESPACE_CREATING
        warmup: NAMESPACE_CREATED || NAMESPACE_CREATE_ERROR
        warmup: POD_CREATING
        warmup: POD_CREATED || POD_CREATE_ERROR
        warmup: CONTAINER_WAITING_READY
        containerWaiting: CONTAINER_READY ||
                          CONTAINER_NOT_FOUND ||
                          CONTAINER_NOT_READY ||
                          CONTAINER_TERMINATED
        warmup: CONTAINER_READY || CONTAINER_NEVER_READY
      */
      ws.send(JSON.stringify({ type: 'warmup', payload: WARMUP_MESSAGES.NAMESPACE_CREATING }))

      const createNamespace = await userKubeApi
        .post(
          `/api/v1/namespaces`,
          { ...getNamespaceBody({ namespaceName }) },
          {
            headers: {
              ...(DEVELOPMENT ? {} : filteredHeaders),
              'Content-Type': 'application/json',
            },
          },
        )
        .then(() => {
          ws.send(JSON.stringify({ type: 'warmup', payload: WARMUP_MESSAGES.NAMESPACE_CREATED }))
          return true
        })
        .catch(error => {
          console.error(`[${new Date().toISOString()}]: Websocket: HandleInit: Namespace not created: ${error}`)
          ws.send(JSON.stringify({ type: 'warmup', payload: `${WARMUP_MESSAGES.NAMESPACE_CREATE_ERROR}: ${error}` }))
          return false
        })

      if (!createNamespace) {
        ws.close()
        return
      }

      const isValidCustomTemplate =
        typeof podTemplateName === 'string' &&
        podTemplateName.length > 0 &&
        typeof podTemplateNamespace === 'string' &&
        podTemplateNamespace.length > 0

      if (!isValidCustomTemplate) {
        console.error(`[${new Date().toISOString()}]: Websocket: HandleInit: PodTemplate is required`)
        ws.send(JSON.stringify({ type: 'warmup', payload: WARMUP_MESSAGES.POD_TEMPLATE_REQUIRED }))
        await cleanUp()
        ws.close()
        return
      }

      ws.send(JSON.stringify({ type: 'warmup', payload: WARMUP_MESSAGES.POD_CREATING }))

      const { data: podTemplate } = await userKubeApi.get<TPodTemplate>(
        `/api/v1/namespaces/${encodeURIComponent(podTemplateNamespace)}/podtemplates/${encodeURIComponent(
          podTemplateName,
        )}`,
        {
          headers: {
            ...(DEVELOPMENT ? {} : filteredHeaders),
            'Content-Type': 'application/json',
          },
        },
      )

      const containerNames = (podTemplate?.template?.spec?.containers ?? [])
        .map(c => c.name)
        .filter((name): name is string => Boolean(name))

      const podTemplateResult = getPodFromPodTemplate({
        podTemplate,
        namespace: namespaceName,
        podName,
        nodeName,
      })

      if (!podTemplateResult.success) {
        console.error(
          `[${new Date().toISOString()}]: Websocket: HandleInit: PodTemplate validation failed: ${
            podTemplateResult.error
          }`,
        )
        ws.send(
          JSON.stringify({
            type: 'warmup',
            payload: `${WARMUP_MESSAGES.POD_TEMPLATE_VALIDATION_ERROR}: ${podTemplateResult.error}`,
          }),
        )
        await cleanUp()
        ws.close()
        return
      }

      const podBody = podTemplateResult.data

      const createPod = await userKubeApi
        .post(
          `/api/v1/namespaces/${namespaceName}/pods`,
          {
            ...podBody,
          },
          {
            headers: {
              ...(DEVELOPMENT ? {} : filteredHeaders),
              'Content-Type': 'application/json',
            },
          },
        )
        .then(() => {
          ws.send(JSON.stringify({ type: 'warmup', payload: WARMUP_MESSAGES.POD_CREATED }))
          return true
        })
        .catch(error => {
          console.error(`[${new Date().toISOString()}]: Websocket: HandleInit: Pod not created: ${error}`)
          ws.send(JSON.stringify({ type: 'warmup', payload: `${WARMUP_MESSAGES.POD_CREATE_ERROR}: ${error}` }))
          return false
        })

      if (!createPod) {
        await cleanUp()
        ws.close()
        return
      }

      ws.send(JSON.stringify({ type: 'warmup', payload: WARMUP_MESSAGES.POD_WAITING_READY }))

      const isReady = await waitForPodRunning({
        namespace: namespaceName,
        podName,
        headers: {
          ...(DEVELOPMENT ? {} : filteredHeaders),
          'Content-Type': 'application/json',
        },
        sendMessage: message => ws.send(JSON.stringify({ type: 'podWaiting', payload: message })),
      })

      if (!isReady) {
        ws.send(JSON.stringify({ type: 'warmup', payload: WARMUP_MESSAGES.POD_NEVER_READY }))
        await cleanUp()
        ws.close()
        return
      }

      ws.send(JSON.stringify({ type: 'warmup', payload: WARMUP_MESSAGES.POD_READY }))

      // STAGE II: Pod is ready - send podReady message with pod info
      console.log(`[${new Date().toISOString()}]: WebsocketPod: Pod ready, containers: ${containerNames.join(', ')}`)

      ws.send(
        JSON.stringify({
          type: 'podReady',
          payload: {
            namespace: namespaceName,
            podName: podName,
            containers: containerNames,
          },
        }),
      )

      ws.on('close', async () => {
        console.log(`[${new Date().toISOString()}]: Websocket: Client disconnected, starting cleanup`)
        await cleanUp()
      })

      ws.on('error', error => {
        console.error(`[${new Date().toISOString()}]: Websocket: WebSocket error:`, error)
      })
    }

    ws.once('message', (message: Buffer) => {
      try {
        console.log(`[${new Date().toISOString()}]: WebSocket: Init message:`, message.toString())
        const parsedMessage = JSON.parse(message.toString()) as TMessage
        handleInit(parsedMessage)
      } catch (error) {
        console.error(`[${new Date().toISOString()}]: WebSocket: Invalid init message:`, {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          error: error,
        })
        ws.close()
      }
    })
  } catch (error) {
    console.error(`[${new Date().toISOString()}]: WebSocket: Error catched`, {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error: error,
    })
  }
}
