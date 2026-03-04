jest.mock('src/constants/envs', () => ({
  WS_LOG_BLACKLIST_PATHS: [],
  WS_LOG_WHITELIST_PATHS: [],
  WS_LOG_PATH_FILTERS_ENABLED: false,
}))

import { sanitizeWsLogPayload, formatWsLogInput } from './wsLogSanitizer'

describe('sanitizeWsLogPayload', () => {
  const payload = {
    error: {
      message: 'boom',
      config: {
        headers: {
          authorization: 'Bearer secret',
          cookie: 'session=secret',
          'x-request-id': 'req-1',
        },
        url: '/api/v1/pods',
      },
      response: {
        status: 403,
      },
    },
    headers: {
      authorization: 'Bearer header-secret',
      'x-real-ip': '127.0.0.1',
    },
  }

  test('returns original payload when no filters are configured', () => {
    expect(sanitizeWsLogPayload(payload, { whitelistPaths: [], blacklistPaths: [] })).toBe(payload)
  })

  test('keeps only whitelisted paths', () => {
    expect(
      sanitizeWsLogPayload(payload, {
        whitelistPaths: ['error.message', 'error.config.url'],
      }),
    ).toEqual({
      error: {
        message: 'boom',
        config: {
          url: '/api/v1/pods',
        },
      },
    })
  })

  test('drops blacklisted subtrees by prefix', () => {
    expect(
      sanitizeWsLogPayload(payload, {
        blacklistPaths: ['error.config.headers.authorization', 'headers.authorization'],
      }),
    ).toEqual({
      error: {
        message: 'boom',
        config: {
          headers: {
            cookie: 'session=secret',
            'x-request-id': 'req-1',
          },
          url: '/api/v1/pods',
        },
        response: {
          status: 403,
        },
      },
      headers: {
        'x-real-ip': '127.0.0.1',
      },
    })
  })

  test('prefers whitelist over blacklist when both are configured', () => {
    expect(
      sanitizeWsLogPayload(payload, {
        whitelistPaths: ['error'],
        blacklistPaths: ['error.config.headers.authorization'],
      }),
    ).toEqual({
      error: {
        message: 'boom',
        config: {
          headers: {
            authorization: 'Bearer secret',
            cookie: 'session=secret',
            'x-request-id': 'req-1',
          },
          url: '/api/v1/pods',
        },
        response: {
          status: 403,
        },
      },
    })
  })

  test('supports nested prefix matches', () => {
    expect(
      sanitizeWsLogPayload(payload, {
        blacklistPaths: ['error.config.headers'],
      }),
    ).toEqual({
      error: {
        message: 'boom',
        config: {
          url: '/api/v1/pods',
        },
        response: {
          status: 403,
        },
      },
      headers: {
        authorization: 'Bearer header-secret',
        'x-real-ip': '127.0.0.1',
      },
    })
  })

  test('passes primitives through unchanged', () => {
    expect(sanitizeWsLogPayload('plain text', { blacklistPaths: ['error.message'] })).toBe('plain text')
  })

  test('formats raw input only when filters are configured', () => {
    expect(formatWsLogInput('raw', { headers: { authorization: 'secret' } }, { blacklistPaths: [] })).toBe('raw')
    expect(
      formatWsLogInput('raw', { headers: { authorization: 'secret' } }, { blacklistPaths: ['headers.authorization'] }),
    ).toEqual({
      headers: {},
    })
  })
})
