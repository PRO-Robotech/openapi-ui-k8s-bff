jest.mock('src/constants/envs', () => ({
  DEVELOPMENT: false,
  WS_LOG_BLACKLIST_PATHS: ['error.config.headers.authorization'],
  WS_LOG_WHITELIST_PATHS: [],
  WS_LOG_PATH_FILTERS_ENABLED: true,
}))

jest.mock('src/constants/httpAgent', () => ({
  baseUrl: 'https://cluster.local',
  userKubeApi: {
    get: jest.fn(),
  },
}))

import { userKubeApi } from 'src/constants/httpAgent'
import { startLogPolling } from './podLogsNonWs'

const mockedGet = userKubeApi.get as jest.Mock

describe('startLogPolling', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    mockedGet.mockReset()
  })

  test('drops authorization from logged WS error payloads when blacklist is configured', async () => {
    const error = new Error('boom') as Error & {
      config: { headers: Record<string, string> }
    }
    error.config = {
      headers: {
        authorization: 'Bearer secret',
        'x-request-id': 'req-1',
      },
    }

    mockedGet.mockRejectedValueOnce(error)
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    await new Promise<void>(resolve => {
      let polling: { stop: () => void }
      polling = startLogPolling(
        {
          url: '/api/v1/namespaces/default/pods/example/log',
          headers: {},
        },
        () => {},
        () => {
          polling.stop()
          resolve()
        },
      )
    })

    const loggedPayload = consoleErrorSpy.mock.calls.find(call => call[0] === 'Error fetching logs:')?.[1] as {
      error: { config: { headers: Record<string, string | undefined> } }
    }

    expect(loggedPayload.error.config.headers.authorization).toBeUndefined()
    expect(loggedPayload.error.config.headers['x-request-id']).toBe('req-1')
  })
})
