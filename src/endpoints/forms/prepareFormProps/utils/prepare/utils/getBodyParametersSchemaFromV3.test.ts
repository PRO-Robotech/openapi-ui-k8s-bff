import { getBodyParametersSchemaFromV3 } from './getBodyParametersSchemaFromV3'

describe('getBodyParametersSchemaFromV3', () => {
  it('extracts schema and kind from application/json requestBody', () => {
    const result = getBodyParametersSchemaFromV3({
      swaggerPath: '/apis/apps/v1/deployments',
      swaggerPathValue: {
        post: {
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    kind: {
                      type: 'string',
                      enum: ['Deployment'],
                    },
                    spec: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          'x-kubernetes-group-version-kind': {
            kind: 'Deployment',
          },
        },
      } as any,
    })

    expect(result).toEqual({
      bodyParametersSchema: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['Deployment'],
          },
          spec: {
            type: 'object',
          },
        },
      },
      kind: 'Deployment',
      error: undefined,
    })
  })

  it('falls back to schema.properties.kind when extension is missing', () => {
    const result = getBodyParametersSchemaFromV3({
      swaggerPath: '/apis/example.io/v1/widgets',
      swaggerPathValue: {
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
                    },
                  },
                },
              },
            },
          },
        },
      } as any,
    })

    expect(result).toEqual({
      bodyParametersSchema: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['Widget'],
          },
          spec: {
            type: 'object',
          },
        },
      },
      kind: 'Widget',
      error: undefined,
    })
  })

  it('returns error when requestBody is missing', () => {
    const result = getBodyParametersSchemaFromV3({
      swaggerPath: '/apis/example.io/v1/widgets',
      swaggerPathValue: {
        post: {},
      } as any,
    })

    expect(result).toEqual({
      bodyParametersSchema: undefined,
      kind: undefined,
      error: 'postData with no requestBody: {}',
    })
  })

  it('returns error when requestBody schema is still a $ref', () => {
    const result = getBodyParametersSchemaFromV3({
      swaggerPath: '/apis/example.io/v1/widgets',
      swaggerPathValue: {
        post: {
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/com.example.Widget',
                },
              },
            },
          },
        },
      } as any,
    })

    expect(result).toEqual({
      bodyParametersSchema: {
        $ref: '#/components/schemas/com.example.Widget',
      },
      kind: undefined,
      error: 'Underefed schema',
    })
  })

  it('returns error when kind cannot be resolved', () => {
    const result = getBodyParametersSchemaFromV3({
      swaggerPath: '/apis/example.io/v1/widgets',
      swaggerPathValue: {
        post: {
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    spec: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
        },
      } as any,
    })

    expect(result).toEqual({
      bodyParametersSchema: {
        type: 'object',
        properties: {
          spec: {
            type: 'object',
          },
        },
      },
      kind: undefined,
      error: 'Unable to resolve kind from v3 operation/schema for /apis/example.io/v1/widgets',
    })
  })

  it('prefers json media type but can fall back to yaml', () => {
    const result = getBodyParametersSchemaFromV3({
      swaggerPath: '/api/v1/pods',
      swaggerPathValue: {
        post: {
          requestBody: {
            content: {
              'application/yaml': {
                schema: {
                  type: 'object',
                  properties: {
                    kind: {
                      type: 'string',
                      default: 'Pod',
                    },
                  },
                },
              },
            },
          },
        },
      } as any,
    })

    expect(result).toEqual({
      bodyParametersSchema: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            default: 'Pod',
          },
        },
      },
      kind: 'Pod',
      error: undefined,
    })
  })
})
