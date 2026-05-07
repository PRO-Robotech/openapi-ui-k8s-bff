import { tryPrepareSchemaFromV3 } from './tryPrepareSchemaFromV3'
import { getOpenApiV3DiscoveryPath, getOpenApiV3Document, getOpenApiV3Index, getOpenApiV3ServerRelativeUrlFromIndex } from 'src/cache'

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

  it('returns success when v3 document contains supported form schema', async () => {
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
      info: { title: 'demo', version: 'v1' },
      paths: {
        '/apis/demo.example.io/v1/widgets': {
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      kind: {
                        type: 'string',
                        enum: ['Widget'],
                      },
                      spec: {
                        type: 'object',
                        properties: {
                          replicas: {
                            type: 'integer',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as any)

    const result = await tryPrepareSchemaFromV3({ data })

    expect(result).toEqual({
      source: 'v3',
      status: 'success',
      bodyParametersSchema: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['Widget'],
          },
          spec: {
            type: 'object',
            properties: {
              replicas: {
                type: 'integer',
              },
            },
          },
        },
      },
      isNamespaced: false,
      kind: 'Widget',
    })
  })

  it('returns unsupported when extracted v3 schema contains blocked keywords', async () => {
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
      info: { title: 'demo', version: 'v1' },
      paths: {
        '/apis/demo.example.io/v1/widgets': {
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      kind: {
                        type: 'string',
                        enum: ['Widget'],
                      },
                      spec: {
                        type: 'object',
                        properties: {
                          mode: {
                            oneOf: [{ type: 'string' }, { type: 'integer' }],
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as any)

    const result = await tryPrepareSchemaFromV3({ data })

    expect(result).toEqual({
      source: 'v3',
      status: 'unsupported',
      error: 'Unsupported OpenAPI v3 schema for auto-generated form: /apis/demo.example.io/v1/widgets',
      issues: [{ keyword: 'oneOf', path: ['spec', 'mode'] }],
      isNamespaced: false,
      kind: 'Widget',
    })
  })

  it('returns success when oneOf is lowered into supported required-group validation metadata', async () => {
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
      info: { title: 'demo', version: 'v1' },
      paths: {
        '/apis/demo.example.io/v1/widgets': {
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      kind: {
                        type: 'string',
                        enum: ['Widget'],
                      },
                      spec: {
                        type: 'object',
                        properties: {
                          command: { type: 'string' },
                          shell: { type: 'string' },
                        },
                        oneOf: [
                          { required: ['command'] },
                          { required: ['shell'] },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as any)

    const result = await tryPrepareSchemaFromV3({ data })

    expect(result).toEqual({
      source: 'v3',
      status: 'success',
      bodyParametersSchema: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['Widget'],
          },
          spec: {
            type: 'object',
            properties: {
              command: { type: 'string' },
              shell: { type: 'string' },
            },
            oneOfRequiredGroups: [['command'], ['shell']],
          },
        },
      },
      isNamespaced: false,
      kind: 'Widget',
    })
  })

  it('returns success when oneOf branches are lowered into supported branch metadata', async () => {
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
      info: { title: 'demo', version: 'v1' },
      paths: {
        '/apis/demo.example.io/v1/widgets': {
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      kind: {
                        type: 'string',
                        enum: ['Widget'],
                      },
                      spec: {
                        type: 'object',
                        required: ['type'],
                        properties: {
                          type: {
                            type: 'string',
                            enum: ['service', 'url'],
                          },
                          service: {
                            type: 'object',
                            required: ['name', 'port'],
                            properties: {
                              name: {
                                type: 'string',
                              },
                              port: {
                                type: 'integer',
                                minimum: 1,
                                maximum: 65535,
                              },
                            },
                          },
                          url: {
                            type: 'string',
                            pattern: '^https?://',
                          },
                        },
                        oneOf: [
                          {
                            required: ['service'],
                            properties: {
                              type: {
                                enum: ['service'],
                              },
                            },
                            not: {
                              required: ['url'],
                            },
                          },
                          {
                            required: ['url'],
                            properties: {
                              type: {
                                enum: ['url'],
                              },
                            },
                            not: {
                              required: ['service'],
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as any)

    const result = await tryPrepareSchemaFromV3({ data })

    expect(result).toEqual({
      source: 'v3',
      status: 'success',
      bodyParametersSchema: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['Widget'],
          },
          spec: {
            type: 'object',
            required: ['type'],
            properties: {
              type: {
                type: 'string',
                enum: ['service', 'url'],
              },
              service: {
                type: 'object',
                required: ['name', 'port'],
                properties: {
                  name: {
                    type: 'string',
                  },
                  port: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 65535,
                  },
                },
              },
              url: {
                type: 'string',
                pattern: '^https?://',
              },
            },
            oneOfBranches: [
              {
                required: ['service'],
                match: {
                  type: 'service',
                },
                forbidden: ['url'],
              },
              {
                required: ['url'],
                match: {
                  type: 'url',
                },
                forbidden: ['service'],
              },
            ],
          },
        },
      },
      isNamespaced: false,
      kind: 'Widget',
    })
  })

  it('returns unsupported when oneOf contains unsupported not constraints', async () => {
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
      info: { title: 'demo', version: 'v1' },
      paths: {
        '/apis/demo.example.io/v1/widgets': {
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      kind: {
                        type: 'string',
                        enum: ['Widget'],
                      },
                      spec: {
                        type: 'object',
                        properties: {
                          type: {
                            type: 'string',
                            enum: ['service', 'url'],
                          },
                          service: {
                            type: 'object',
                          },
                          url: {
                            type: 'string',
                          },
                        },
                        oneOf: [
                          {
                            required: ['service'],
                            properties: {
                              type: {
                                enum: ['service'],
                              },
                            },
                            not: {
                              properties: {
                                url: {
                                  type: 'string',
                                },
                              },
                            },
                          },
                          {
                            required: ['url'],
                            properties: {
                              type: {
                                enum: ['url'],
                              },
                            },
                            not: {
                              required: ['service'],
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as any)

    const result = await tryPrepareSchemaFromV3({ data })

    expect(result).toEqual({
      source: 'v3',
      status: 'unsupported',
      error: 'Unsupported OpenAPI v3 schema for auto-generated form: /apis/demo.example.io/v1/widgets',
      issues: [{ keyword: 'oneOf', path: ['spec'] }],
      isNamespaced: false,
      kind: 'Widget',
    })
  })

  it('normalizes singleton metadata allOf wrappers before support check', async () => {
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
      info: { title: 'demo', version: 'v1' },
      paths: {
        '/apis/demo.example.io/v1/widgets': {
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      kind: {
                        type: 'string',
                        enum: ['Widget'],
                      },
                      metadata: {
                        description: "Standard object's metadata",
                        allOf: [
                          {
                            type: 'object',
                            properties: {
                              name: {
                                type: 'string',
                              },
                              namespace: {
                                type: 'string',
                              },
                            },
                          },
                        ],
                      },
                      spec: {
                        type: 'object',
                        properties: {
                          replicas: {
                            type: 'integer',
                            default: 3,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as any)

    const result = await tryPrepareSchemaFromV3({ data })

    expect(result).toEqual({
      source: 'v3',
      status: 'success',
      bodyParametersSchema: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['Widget'],
          },
          metadata: {
            type: 'object',
            description: "Standard object's metadata",
            properties: {
              name: {
                type: 'string',
              },
              namespace: {
                type: 'string',
              },
            },
          },
          spec: {
            type: 'object',
            properties: {
              replicas: {
                type: 'integer',
                default: 3,
              },
            },
          },
        },
      },
      isNamespaced: false,
      kind: 'Widget',
    })
  })

  it('returns success when compatible multi-entry allOf can be flattened for the form', async () => {
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
      info: { title: 'demo', version: 'v1' },
      paths: {
        '/apis/demo.example.io/v1/widgets': {
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      kind: {
                        type: 'string',
                        enum: ['Widget'],
                      },
                      spec: {
                        description: 'Desired widget spec',
                        allOf: [
                          {
                            type: 'object',
                            properties: {
                              replicas: {
                                type: 'integer',
                                default: 3,
                              },
                            },
                            required: ['replicas'],
                          },
                          {
                            type: 'object',
                            properties: {
                              image: {
                                type: 'string',
                              },
                            },
                            required: ['image'],
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as any)

    const result = await tryPrepareSchemaFromV3({ data })

    expect(result).toEqual({
      source: 'v3',
      status: 'success',
      bodyParametersSchema: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['Widget'],
          },
          spec: {
            type: 'object',
            description: 'Desired widget spec',
            properties: {
              replicas: {
                type: 'integer',
                default: 3,
              },
              image: {
                type: 'string',
              },
            },
            required: ['replicas', 'image'],
          },
        },
      },
      isNamespaced: false,
      kind: 'Widget',
    })
  })

  it('keeps conflicting multi-entry allOf in manual fallback path', async () => {
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
      info: { title: 'demo', version: 'v1' },
      paths: {
        '/apis/demo.example.io/v1/widgets': {
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      kind: {
                        type: 'string',
                        enum: ['Widget'],
                      },
                      spec: {
                        allOf: [
                          {
                            type: 'object',
                          },
                          {
                            type: 'string',
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as any)

    const result = await tryPrepareSchemaFromV3({ data })

    expect(result).toEqual({
      source: 'v3',
      status: 'unsupported',
      error: 'Unsupported OpenAPI v3 schema for auto-generated form: /apis/demo.example.io/v1/widgets',
      issues: [{ keyword: 'allOf', path: ['spec'] }],
      isNamespaced: false,
      kind: 'Widget',
    })
  })
})
