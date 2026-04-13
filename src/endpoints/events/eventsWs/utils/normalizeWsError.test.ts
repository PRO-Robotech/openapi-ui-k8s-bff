import { normalizeWsError } from './normalizeWsError'

describe('normalizeWsError', () => {
  test('maps 403 to access denied user message', () => {
    const result = normalizeWsError({
      response: {
        status: 403,
        data: {
          reason: 'Forbidden',
          message: 'events is forbidden',
        },
      },
    })

    expect(result).toEqual({
      statusCode: 403,
      reason: 'Forbidden',
      message: 'events is forbidden',
      userMessage: 'Access denied (403)',
    })
  })

  test('maps 401 to unauthorized user message', () => {
    const result = normalizeWsError({
      response: {
        status: 401,
        data: {
          reason: 'Unauthorized',
          message: 'token expired',
        },
      },
    })

    expect(result).toEqual({
      statusCode: 401,
      reason: 'Unauthorized',
      message: 'token expired',
      userMessage: 'Unauthorized (401)',
    })
  })

  test('keeps fallback message for generic errors without status code', () => {
    const result = normalizeWsError(new Error('network down'))

    expect(result).toEqual({
      statusCode: undefined,
      reason: undefined,
      message: 'network down',
      userMessage: 'Initial events load failed',
    })
  })

  test('uses fallback user message and appends status code for non-auth errors', () => {
    const result = normalizeWsError(
      {
        body: {
          code: 500,
          reason: 'InternalError',
          message: 'unexpected failure',
        },
      },
      'Error starting watch',
    )

    expect(result).toEqual({
      statusCode: 500,
      reason: 'InternalError',
      message: 'unexpected failure',
      userMessage: 'Error starting watch (500)',
    })
  })
})
