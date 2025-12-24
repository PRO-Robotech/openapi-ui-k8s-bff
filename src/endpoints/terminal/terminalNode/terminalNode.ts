/* eslint-disable max-lines-per-function */
import WebSocket from 'ws'
import { WebsocketRequestHandler } from 'express-ws'
import { DEVELOPMENT, DEBUG_CONTAINER_IMAGE } from 'src/constants/envs'
import { httpsAgent, baseUrl, userKubeApi } from 'src/constants/httpAgent'
import { filterHeadersFromEnv } from 'src/utils/filterHeadersFromEnv'
import { generateRandomLetters, getNamespaceBody, getPodByProfile, getPodFromPodTemplate, waitForContainerReady } from './utils'
import { SHUTDOWN_MESSAGES, WARMUP_MESSAGES } from './constants'

export type TMessage = {
  type: string
  payload: any
}

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

      const nodeName = message.payload.nodeName
      const profile = message.payload.profile
      const podTemplateName = message.payload.podTemplateName
      const podTemplateNamespace = message.payload.podTemplateNamespace
      const customContainerName = message.payload.containerName
      const randomLetters = generateRandomLetters()
      const namespaceName = `debugger-${nodeName}-bff-${randomLetters}`
      const podName = `debugger-${nodeName}-bff-${randomLetters}`
      const container = typeof customContainerName === 'string' && customContainerName.length > 0
        ? customContainerName
        : 'debugger'

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

      ws.send(JSON.stringify({ type: 'warmup', payload: WARMUP_MESSAGES.POD_CREATING }))

      const isUsingCustomTemplate =
        typeof podTemplateName === 'string' &&
        podTemplateName.length > 0 &&
        typeof podTemplateNamespace === 'string' &&
        podTemplateNamespace.length > 0

      let podBody: Record<string, unknown> | null = null

      if (isUsingCustomTemplate) {
        const { data: podTemplate } = await userKubeApi.get(
          `/api/v1/namespaces/${encodeURIComponent(podTemplateNamespace)}/podtemplates/${encodeURIComponent(podTemplateName)}`,
          {
            headers: {
              ...(DEVELOPMENT ? {} : filteredHeaders),
              'Content-Type': 'application/json',
            },
          },
        )

        const podTemplateResult = getPodFromPodTemplate({
          podTemplate: podTemplate as Parameters<typeof getPodFromPodTemplate>[0]['podTemplate'],
          namespace: namespaceName,
          podName,
          nodeName,
          containerName: container,
        })

        if (!podTemplateResult.success) {
          console.error(`[${new Date().toISOString()}]: Websocket: HandleInit: PodTemplate validation failed: ${podTemplateResult.error}`)
          ws.send(JSON.stringify({ type: 'warmup', payload: `${WARMUP_MESSAGES.POD_TEMPLATE_VALIDATION_ERROR}: ${podTemplateResult.error}` }))
          await cleanUp()
          ws.close()
          return
        }

        podBody = podTemplateResult.data
      } else {
        podBody = getPodByProfile({
          namespace: namespaceName,
          podName,
          nodeName,
          containerImage: DEBUG_CONTAINER_IMAGE,
          containerName: container,
          profile,
        })
      }

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

      ws.send(JSON.stringify({ type: 'warmup', payload: WARMUP_MESSAGES.CONTAINER_WAITING_READY }))

      const isReady = await waitForContainerReady({
        namespace: namespaceName,
        podName,
        containerName: container,
        maxAttempts: 25,
        retryIntervalMs: 5000,
        headers: {
          ...(DEVELOPMENT ? {} : filteredHeaders),
          'Content-Type': 'application/json',
        },
        sendMessage: message => ws.send(JSON.stringify({ type: 'containerWaiting', payload: message })),
      })

      if (!isReady) {
        ws.send(JSON.stringify({ type: 'warmup', payload: WARMUP_MESSAGES.CONTAINER_NEVER_READY }))
        await cleanUp()
        ws.close()
        return
      }

      ws.send(JSON.stringify({ type: 'warmup', payload: WARMUP_MESSAGES.CONTAINER_READY }))

      // STAGE II: default pod terminal logic
      const wrapper = 'stty cols 999; exec /bin/sh'

      const execUrl = [
        `${baseUrl}/api/v1/namespaces/${namespaceName}/pods/${podName}/exec?&container=${container}&stdin=true&stdout=true&tty=true`,
        `&command=${encodeURIComponent('sh')}`,
        `&command=${encodeURIComponent('-c')}`,
        `&command=${encodeURIComponent(wrapper)}`,
      ].join('')

      console.log(
        `[${new Date().toISOString()}]: WebsocketPod: Connecting with user headers ${JSON.stringify(
          DEVELOPMENT ? {} : filteredHeaders,
        )}`,
      )
      try {
        const podWs = new WebSocket(execUrl, {
          // Only attach https agent for https://. For http:// (dev via port-forward),
          // passing httpsAgent causes ERR_INVALID_PROTOCOL.
          ...(execUrl.startsWith('https://') ? { agent: httpsAgent } : {}),
          headers: {
            ...(DEVELOPMENT ? {} : filteredHeaders),
          },
          protocol: 'v5.channel.k8s.io',
          handshakeTimeout: 5_000,
        })

        podWs.on('open', () => {
          console.log(`[${new Date().toISOString()}]: WebsocketPod: Connected to pod terminal`)
        })

        podWs.on('message', data => {
          ws.send(JSON.stringify({ type: 'output', payload: data }))
        })

        podWs.on('close', async () => {
          console.log(`[${new Date().toISOString()}]: WebsocketPod: Disconnected from pod terminal`)
          await cleanUp()
          ws.close()
        })

        podWs.on('error', error => {
          console.error(`[${new Date().toISOString()}]: WebsocketPod: Pod WebSocket error:`, error)
        })

        ws.on('message', async message => {
          const parsedMessage = JSON.parse(message.toString()) as TMessage
          if (parsedMessage.type === 'input') {
            podWs.send(Buffer.from(`\x00${parsedMessage.payload}`, 'utf8'))
          }
          // shutdown message
          // if (parsedMessage.type === 'shutdown') {
          //   await cleanUp()
          //   ws.close()
          // }
        })

        ws.on('close', async () => {
          ws.send(JSON.stringify({ type: 'shutdown', payload: SHUTDOWN_MESSAGES.SHUTDOWN }))

          podWs.close()
          await cleanUp()
        })
      } catch (error) {
        await cleanUp()
        ws.close()
        console.error(`[${new Date().toISOString()}]: WebSocket: Error catched`, {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          error: error,
        })
      }
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
