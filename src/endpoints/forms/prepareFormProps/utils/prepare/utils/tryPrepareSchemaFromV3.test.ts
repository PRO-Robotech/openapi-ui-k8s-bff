import { tryPrepareSchemaFromV3 } from './tryPrepareSchemaFromV3'
import {
  getOpenApiV3DiscoveryPath,
  getOpenApiV3Document,
  getOpenApiV3Index,
  getOpenApiV3ServerRelativeUrlFromIndex,
} from 'src/cache'

jest.mock('src/cache', () => ({
  getOpenApiV3DiscoveryPath: jest.fn(),
  getOpenApiV3Document: jest.fn(),
  getOpenApiV3Index: jest.fn(),
  getOpenApiV3ServerRelativeUrlFromIndex: jest.fn(),
}))

const mockedGetOpenApiV3DiscoveryPath = jest.mocked(getOpenApiV3DiscoveryPath)
const mockedGetOpenApiV3Document = jest.mocked(getOpenApiV3Document)
const mockedGetOpenApiV3Index = jest.mocked(getOpenApiV3Index)
const mockedGetOpenApiV3ServerRelativeUrlFromIndex = jest.mocked(getOpenApiV3ServerRelativeUrlFromIndex)

const data = {
  type: 'apis' as const,
  apiGroup: 'demo.example.io',
  apiVersion: 'v1',
  plural: 'widgets',
}

describe('tryPrepareSchemaFromV3', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    mockedGetOpenApiV3DiscoveryPath.mockReturnValue('apis/demo.example.io/v1')
  })

  it('returns unavailable when v3 discovery index cannot be loaded', async () => {
    mockedGetOpenApiV3Index.mockResolvedValue(undefined)

    const result = await tryPrepareSchemaFromV3({ data })

    expect(result).toEqual({
      source: 'v3',
      status: 'unavailable',
      error: 'OpenAPI v3 discovery index is unavailable',
    })
    expect(mockedGetOpenApiV3ServerRelativeUrlFromIndex).not.toHaveBeenCalled()
    expect(mockedGetOpenApiV3Document).not.toHaveBeenCalled()
  })

  it('returns unavailable when discovery entry is missing', async () => {
    mockedGetOpenApiV3Index.mockResolvedValue({ paths: {} })
    mockedGetOpenApiV3ServerRelativeUrlFromIndex.mockReturnValue(undefined)

    const result = await tryPrepareSchemaFromV3({ data })

    expect(result).toEqual({
      source: 'v3',
      status: 'unavailable',
      error: 'OpenAPI v3 discovery entry not found for apis/demo.example.io/v1',
    })
    expect(mockedGetOpenApiV3ServerRelativeUrlFromIndex).toHaveBeenCalledWith({
      discoveryIndex: { paths: {} },
      discoveryPath: 'apis/demo.example.io/v1',
    })
    expect(mockedGetOpenApiV3Document).not.toHaveBeenCalled()
  })

  it('returns technical error when v3 document fetch fails', async () => {
    mockedGetOpenApiV3Index.mockResolvedValue({
      paths: {
        'apis/demo.example.io/v1': {
          serverRelativeURL: '/openapi/v3/apis/demo.example.io/v1?hash=abc',
        },
      },
    })
    mockedGetOpenApiV3ServerRelativeUrlFromIndex.mockReturnValue('/openapi/v3/apis/demo.example.io/v1?hash=abc')
    mockedGetOpenApiV3Document.mockResolvedValue(undefined)

    const result = await tryPrepareSchemaFromV3({ data })

    expect(result).toEqual({
      source: 'v3',
      status: 'error',
      error: 'Failed to load OpenAPI v3 document for apis/demo.example.io/v1',
      isNamespaced: false,
      kind: undefined,
    })
  })

  it('returns staged error after v3 document is resolved but extraction is not implemented yet', async () => {
    mockedGetOpenApiV3Index.mockResolvedValue({
      paths: {
        'apis/demo.example.io/v1': {
          serverRelativeURL: '/openapi/v3/apis/demo.example.io/v1?hash=abc',
        },
      },
    })
    mockedGetOpenApiV3ServerRelativeUrlFromIndex.mockReturnValue('/openapi/v3/apis/demo.example.io/v1?hash=abc')
    mockedGetOpenApiV3Document.mockResolvedValue({
      openapi: '3.0.0',
      paths: {},
      info: { title: 'demo', version: 'v1' },
    })

    const result = await tryPrepareSchemaFromV3({ data })

    expect(result).toEqual({
      source: 'v3',
      status: 'error',
      error: 'OpenAPI v3 document resolved for apis/demo.example.io/v1, but schema extraction is not implemented yet',
      isNamespaced: false,
      kind: undefined,
    })
  })
})
