import WebSocket from 'ws'
import { AxiosRequestConfig } from 'axios'
import { WebsocketRequestHandler } from 'express-ws'
import { DEVELOPMENT } from 'src/constants/envs'
import { baseUrl, userKubeApi } from 'src/constants/httpAgent'
import { filterHeadersFromEnv } from 'src/utils/filterHeadersFromEnv'
import { formatWsLogInput, getWsRawMessageMetadata, sanitizeWsLogPayload } from 'src/utils/wsLogSanitizer'

export type TMessage = {
  type: string
  payload: any
}

export const startLogPolling = (
  {
    url,
    headers,
    pollIntervalMs = 5000,
  }: { url: string; headers: AxiosRequestConfig['headers']; pollIntervalMs?: number },
  onNewLines: (lines: string) => void,
  onError?: (error: string) => void,
): { stop: () => void } => {
  let canceled = false
  let prevLatestTimestamp: Date | null = null
  let latestTimestamp: Date | null = null

  console.log(
    `[${new Date().toISOString()}]: Websocket: Using headers to fetch`,
    formatWsLogInput(JSON.stringify(headers), { headers }),
  )
  const doFetch = async () => {
    try {
      const {
        status,
        statusText,
        data: initLogs,
      } = await userKubeApi.get(url, {
        headers,
      })
      if (!status || status !== 200) {
        console.error('Log fetch failed:', statusText)
        return
      }
      const initLogsSplitted: string[] = initLogs.split('\n')

      initLogsSplitted.forEach(line => {
        const lineDate = line.split(' ')[0]
        if (lineDate && lineDate.length > 1) {
          const lineDateParsed = new Date(lineDate)
          if (!latestTimestamp) {
            latestTimestamp = lineDateParsed
          }
          if (lineDateParsed > latestTimestamp) {
            latestTimestamp = lineDateParsed
          }
        }
      })

      // console.log(latestTimestamp)

      const initLogsWithoutTimestamps = initLogsSplitted
        .filter(line => {
          const index = line.indexOf(' ')
          const timestamp = line.slice(0, index)
          // const rest = line.slice(index + 1)
          if (prevLatestTimestamp) {
            return new Date(timestamp) > prevLatestTimestamp
          }
          return true
        })
        .map(line => {
          const index = line.indexOf(' ')
          // const timestamp = line.slice(0, index)
          const rest = line.slice(index + 1)
          return rest
        })
        .join('\n')

      prevLatestTimestamp = latestTimestamp

      // Send to callback
      onNewLines(initLogsWithoutTimestamps)
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data ||
        (error instanceof Error ? error.message : String(error))

      console.error(
        'Error fetching logs:',
        sanitizeWsLogPayload({
          message: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          error: error,
        }),
      )

      if (onError) {
        onError(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage))
      }
    }
  }

  // Kick off initial fetch, then poll
  ;(async () => {
    await doFetch()
    // Schedule recurring polls
    while (!canceled) {
      await new Promise(res => setTimeout(res, pollIntervalMs))
      await doFetch()
    }
  })()

  return {
    stop: () => {
      canceled = true
    },
  }
}

export const podLogsNonWsWebSocket: WebsocketRequestHandler = async (ws, req) => {
  console.log(`[${new Date().toISOString()}]: Websocket: Client connected to WebSocket server`)

  const filteredHeaders = filterHeadersFromEnv(req)

  console.log(
    `[${new Date().toISOString()}]: Websocket: Filtered Headers:`,
    formatWsLogInput(JSON.stringify(filteredHeaders), { headers: filteredHeaders }),
  )

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

      const namespace = message.payload.namespace
      const podName = message.payload.podName
      const container = message.payload.container
      const previous = message.payload.previous
      const tailLines = message.payload.tailLines
      const sinceSeconds = message.payload.sinceSeconds
      const sinceTime = message.payload.sinceTime
      const limitBytes = message.payload.limitBytes

      ws.send(JSON.stringify({ type: 'ready' }))

      const params = new URLSearchParams({
        container,
        timestamps: 'true',
      })

      if (tailLines !== undefined && tailLines !== null) {
        params.append('tailLines', String(tailLines))
      }

      // sinceTime takes precedence over sinceSeconds (more specific)
      if (sinceTime !== undefined && sinceTime !== null) {
        params.append('sinceTime', sinceTime)
      } else if (sinceSeconds !== undefined && sinceSeconds !== null) {
        params.append('sinceSeconds', String(sinceSeconds))
      }

      if (limitBytes !== undefined && limitBytes !== null) {
        params.append('limitBytes', String(limitBytes))
      }

      const execUrlNoFollow = `${baseUrl}/api/v1/namespaces/${namespace}/pods/${podName}/log?${params.toString()}${
        previous ? `&previous=${previous}` : ''
      }`

      let pause = false
      let buffer: string[] = []

      const { stop } = startLogPolling(
        {
          url: execUrlNoFollow,
          headers: {
            ...(DEVELOPMENT ? {} : filteredHeaders),
            'Content-Type': 'application/json',
          },
          pollIntervalMs: 3000, // optional, defaults to 5s
        },
        newLines => {
          if (pause) {
            buffer.push(newLines)
            return
          }
          ws.send(JSON.stringify({ type: 'output', payload: newLines }))
        },
        errorMessage => {
          ws.send(JSON.stringify({ type: 'error', payload: errorMessage }))
        },
      )

      ws.on('message', message => {
        const parsedMessage = JSON.parse(message.toString()) as TMessage

        if (parsedMessage.type === 'stop') {
          console.log(`[${new Date().toISOString()}]: WebsocketPod: Logs Paused`)
          pause = true
          return
        }

        if (parsedMessage.type === 'continue') {
          console.log(`[${new Date().toISOString()}]: WebsocketPod: Logs Continue`)
          buffer.forEach(msg => ws.send(JSON.stringify({ type: 'output', payload: msg })))
          buffer = []
          pause = false
          return
        }
      })

      ws.on('close', () => {
        stop()
        console.log(`[${new Date().toISOString()}]: Websocket: Client disconnected`)
      })
    }

    ws.once('message', (message: Buffer) => {
      const rawMessage = message.toString()
      try {
        const parsedMessage = JSON.parse(rawMessage) as TMessage
        console.log(
          `[${new Date().toISOString()}]: WebSocket: Init message:`,
          formatWsLogInput(rawMessage, { message: parsedMessage }),
        )
        handleInit(parsedMessage)
      } catch (error) {
        console.error(
          `[${new Date().toISOString()}]: WebSocket: Invalid init message:`,
          sanitizeWsLogPayload({
            ...getWsRawMessageMetadata(rawMessage),
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            error: error,
          }),
        )
        ws.close()
      }
    })
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}]: WebSocket: Error catched:`,
      sanitizeWsLogPayload({
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        error: error,
      }),
    )
  }
}
