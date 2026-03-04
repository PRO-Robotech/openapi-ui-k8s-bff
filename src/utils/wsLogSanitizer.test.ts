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

  describe('** globstar wildcard', () => {
    test('**.authorization blacklist strips authorization at any depth', () => {
      expect(
        sanitizeWsLogPayload(payload, {
          blacklistPaths: ['**.authorization'],
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

    test('**.headers blacklist strips entire headers subtrees at any depth', () => {
      expect(
        sanitizeWsLogPayload(payload, {
          blacklistPaths: ['**.headers'],
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
      })
    })

    test('** at end of pattern strips entire subtree from that point', () => {
      expect(
        sanitizeWsLogPayload(payload, {
          blacklistPaths: ['error.config.**'],
        }),
      ).toEqual({
        error: {
          message: 'boom',
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

    test('** in the middle of a pattern', () => {
      expect(
        sanitizeWsLogPayload(payload, {
          blacklistPaths: ['error.**.authorization'],
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
          authorization: 'Bearer header-secret',
          'x-real-ip': '127.0.0.1',
        },
      })
    })
  })

  describe('* single-segment wildcard', () => {
    test('*.authorization matches one level only', () => {
      expect(
        sanitizeWsLogPayload(payload, {
          blacklistPaths: ['*.authorization'],
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
        headers: {
          'x-real-ip': '127.0.0.1',
        },
      })
    })

    test('error.*.headers matches error.config.headers but not deeper', () => {
      expect(
        sanitizeWsLogPayload(payload, {
          blacklistPaths: ['error.*.headers'],
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
  })

  describe('mixed wildcards with exact paths', () => {
    test('combines ** wildcard with exact path', () => {
      expect(
        sanitizeWsLogPayload(payload, {
          blacklistPaths: ['**.cookie', 'headers.authorization'],
        }),
      ).toEqual({
        error: {
          message: 'boom',
          config: {
            headers: {
              authorization: 'Bearer secret',
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
  })

  describe('wildcard whitelist', () => {
    test('**.message keeps only message fields at any depth', () => {
      expect(
        sanitizeWsLogPayload(payload, {
          whitelistPaths: ['**.message'],
        }),
      ).toEqual({
        error: {
          message: 'boom',
        },
      })
    })

    test('*.* keeps all fields one level deep', () => {
      expect(
        sanitizeWsLogPayload(
          { a: { x: 1, y: 2 }, b: { z: 3 }, c: 'flat' },
          { whitelistPaths: ['*.*'] },
        ),
      ).toEqual({
        a: { x: 1, y: 2 },
        b: { z: 3 },
      })
    })
  })
})
