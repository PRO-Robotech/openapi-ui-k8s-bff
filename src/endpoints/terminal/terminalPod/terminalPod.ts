import WebSocket from 'ws'
import { WebsocketRequestHandler } from 'express-ws'
import { DEVELOPMENT } from 'src/constants/envs'
import { httpsAgent, baseUrl } from 'src/constants/httpAgent'
import { filterHeadersFromEnv } from 'src/utils/filterHeadersFromEnv'

export type TMessage = {
  type: string
  payload: any
}

export const terminalPodWebSocket: WebsocketRequestHandler = async (ws, req) => {
  console.log(`[${new Date().toISOString()}]: Websocket: Client connected to WebSocket server`)

  const filteredHeaders = filterHeadersFromEnv(req)

  try {
    const handleInit = (message: TMessage) => {
      if (message.type !== 'init') {
        console.error(
          `[${new Date().toISOString()}]: Websocket: HandleInit: First message must be init, but got type: ${
            message.type
          }`,
        )
        ws.close()
        return
      }

      const namespace = message.payload.namespace
      const podName = message.payload.podName
      const container = message.payload.container

      const wrapper = 'stty cols 999; exec /bin/sh'

      const execUrl = [
        `${baseUrl}/api/v1/namespaces/${namespace}/pods/${podName}/exec?container=${container}&stdin=true&stdout=true&tty=true`,
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
          agent: httpsAgent,
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
          // ws.send(data.toString())
          ws.send(JSON.stringify({ type: 'output', payload: data }))
        })

        podWs.on('close', () => {
          console.log(`[${new Date().toISOString()}]: WebsocketPod: Disconnected from pod terminal`)
          ws.close()
        })

        podWs.on('error', error => {
          console.error(`[${new Date().toISOString()}]: WebsocketPod: Pod WebSocket error:`, error)
        })

        ws.on('message', message => {
          const parsedMessage = JSON.parse(message.toString()) as TMessage
          if (parsedMessage.type === 'input') {
            podWs.send(Buffer.from(`\x00${parsedMessage.payload}`, 'utf8'))
          }
        })

        ws.on('close', () => {
          console.log(`[${new Date().toISOString()}]: Websocket: Client disconnected`)
          podWs.close()
        })
      } catch (error) {
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
