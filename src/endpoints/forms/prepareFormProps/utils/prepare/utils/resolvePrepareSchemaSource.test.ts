import { resolvePrepareSchemaSource } from './resolvePrepareSchemaSource'
import { tryPrepareSchemaFromV2 } from './tryPrepareSchemaFromV2'
import { tryPrepareSchemaFromV3 } from './tryPrepareSchemaFromV3'

jest.mock('./tryPrepareSchemaFromV2', () => ({
  tryPrepareSchemaFromV2: jest.fn(),
}))

jest.mock('./tryPrepareSchemaFromV3', () => ({
  tryPrepareSchemaFromV3: jest.fn(),
}))

const mockedTryPrepareSchemaFromV2 = jest.mocked(tryPrepareSchemaFromV2)
const mockedTryPrepareSchemaFromV3 = jest.mocked(tryPrepareSchemaFromV3)

const data = {
  type: 'builtin' as const,
  plural: 'pods',
}

describe('resolvePrepareSchemaSource', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('keeps v3 result when schema is supported', async () => {
    mockedTryPrepareSchemaFromV3.mockResolvedValue({
      source: 'v3',
      status: 'success',
      bodyParametersSchema: { type: 'object', properties: {} },
      isNamespaced: true,
      kind: 'Pod',
    })

    const result = await resolvePrepareSchemaSource({ data })

    expect(result).toEqual({
      source: 'v3',
      status: 'success',
      bodyParametersSchema: { type: 'object', properties: {} },
      isNamespaced: true,
      kind: 'Pod',
    })
    expect(mockedTryPrepareSchemaFromV2).not.toHaveBeenCalled()
  })

  it('keeps v3 result when schema is unsupported for form mode', async () => {
    mockedTryPrepareSchemaFromV3.mockResolvedValue({
      source: 'v3',
      status: 'unsupported',
      error: 'Unsupported OpenAPI v3 schema for auto-generated form',
      issues: [{ keyword: 'oneOf', path: ['spec'] }],
      isNamespaced: false,
      kind: 'Widget',
    })

    const result = await resolvePrepareSchemaSource({ data })

    expect(result).toEqual({
      source: 'v3',
      status: 'unsupported',
      error: 'Unsupported OpenAPI v3 schema for auto-generated form',
      issues: [{ keyword: 'oneOf', path: ['spec'] }],
      isNamespaced: false,
      kind: 'Widget',
    })
    expect(mockedTryPrepareSchemaFromV2).not.toHaveBeenCalled()
  })

  it('falls back to v2 when v3 source is unavailable', async () => {
    mockedTryPrepareSchemaFromV3.mockResolvedValue({
      source: 'v3',
      status: 'unavailable',
      error: 'OpenAPI v3 is unavailable',
    })
    mockedTryPrepareSchemaFromV2.mockResolvedValue({
      source: 'v2',
      status: 'success',
      bodyParametersSchema: { type: 'object', properties: {} },
      isNamespaced: true,
      kind: 'Pod',
    })

    const result = await resolvePrepareSchemaSource({ data })

    expect(result).toEqual({
      source: 'v2',
      status: 'success',
      bodyParametersSchema: { type: 'object', properties: {} },
      isNamespaced: true,
      kind: 'Pod',
    })
    expect(mockedTryPrepareSchemaFromV2).toHaveBeenCalledWith({ data })
  })

  it('falls back to v2 when v3 extraction fails technically', async () => {
    mockedTryPrepareSchemaFromV3.mockResolvedValue({
      source: 'v3',
      status: 'error',
      error: 'Failed to resolve requestBody',
      isNamespaced: false,
      kind: 'Widget',
    })
    mockedTryPrepareSchemaFromV2.mockResolvedValue({
      source: 'v2',
      status: 'error',
      error: 'No post data for /apis/demo/v1/widgets',
      isNamespaced: false,
      kind: 'Widget',
    })

    const result = await resolvePrepareSchemaSource({ data })

    expect(result).toEqual({
      source: 'v2',
      status: 'error',
      error: 'No post data for /apis/demo/v1/widgets',
      isNamespaced: false,
      kind: 'Widget',
    })
    expect(mockedTryPrepareSchemaFromV2).toHaveBeenCalledWith({ data })
  })

  it('falls back to a usable v2 schema when v3 extraction fails technically', async () => {
    mockedTryPrepareSchemaFromV3.mockResolvedValue({
      source: 'v3',
      status: 'error',
      error: 'Failed to resolve requestBody',
      isNamespaced: true,
      kind: 'Widget',
    })
    mockedTryPrepareSchemaFromV2.mockResolvedValue({
      source: 'v2',
      status: 'success',
      bodyParametersSchema: {
        type: 'object',
        properties: {
          spec: {
            type: 'object',
          },
        },
      },
      isNamespaced: true,
      kind: 'Widget',
    })

    const result = await resolvePrepareSchemaSource({ data })

    expect(result).toEqual({
      source: 'v2',
      status: 'success',
      bodyParametersSchema: {
        type: 'object',
        properties: {
          spec: {
            type: 'object',
          },
        },
      },
      isNamespaced: true,
      kind: 'Widget',
    })
    expect(mockedTryPrepareSchemaFromV2).toHaveBeenCalledWith({ data })
  })
})
