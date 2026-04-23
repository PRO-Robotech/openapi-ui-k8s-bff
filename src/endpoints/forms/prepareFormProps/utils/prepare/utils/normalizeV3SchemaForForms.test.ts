import { normalizeV3SchemaForForms } from './normalizeV3SchemaForForms'

describe('normalizeV3SchemaForForms', () => {
  it('unwraps singleton allOf wrappers like Kubernetes ObjectMeta', () => {
    const result = normalizeV3SchemaForForms({
      type: 'object',
      properties: {
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
              required: ['name'],
            } as any,
          ],
        } as any,
      },
    })

    expect(result).toEqual({
      type: 'object',
      properties: {
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
          required: ['name'],
        },
      },
    })
  })

  it('unwraps singleton allOf recursively in items and additionalProperties', () => {
    const result = normalizeV3SchemaForForms({
      type: 'object',
      properties: {
        entries: {
          type: 'array',
          items: {
            allOf: [
              {
                type: 'object',
                properties: {
                  value: {
                    type: 'string',
                  },
                },
              } as any,
            ],
          } as any,
        },
        labels: {
          type: 'object',
          additionalProperties: {
            allOf: [
              {
                type: 'string',
              } as any,
            ],
          } as any,
        },
      },
    })

    expect(result).toEqual({
      type: 'object',
      properties: {
        entries: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: {
                type: 'string',
              },
            },
          },
        },
        labels: {
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
        },
      },
    })
  })

  it('preserves example on leaf nodes and through singleton allOf unwrap', () => {
    const result = normalizeV3SchemaForForms({
      type: 'object',
      properties: {
        image: {
          type: 'string',
          example: 'registry.example.com/app:v1.2.3',
        },
        metadata: {
          description: "Standard object's metadata",
          example: { name: 'demo' },
          allOf: [
            {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  example: 'demo',
                },
              },
            } as any,
          ],
        } as any,
      },
    })

    expect(result).toEqual({
      type: 'object',
      properties: {
        image: {
          type: 'string',
          example: 'registry.example.com/app:v1.2.3',
        },
        metadata: {
          type: 'object',
          description: "Standard object's metadata",
          example: { name: 'demo' },
          properties: {
            name: {
              type: 'string',
              example: 'demo',
            },
          },
        },
      },
    })
  })

  it('preserves nullable on leaf nodes and through singleton allOf unwrap', () => {
    const result = normalizeV3SchemaForForms({
      type: 'object',
      properties: {
        schedule: {
          type: 'string',
          nullable: true,
        },
        config: {
          description: 'Optional configuration',
          allOf: [
            {
              type: 'object',
              nullable: true,
              properties: {
                raw: {
                  type: 'string',
                  nullable: true,
                },
              },
            } as any,
          ],
        } as any,
      },
    })

    expect(result).toEqual({
      type: 'object',
      properties: {
        schedule: {
          type: 'string',
          nullable: true,
        },
        config: {
          type: 'object',
          description: 'Optional configuration',
          nullable: true,
          properties: {
            raw: {
              type: 'string',
              nullable: true,
            },
          },
        },
      },
    })
  })

  it('preserves multi-entry allOf so unsupported policy can still catch it', () => {
    const result = normalizeV3SchemaForForms({
      type: 'object',
      properties: {
        spec: {
          allOf: [{ type: 'object' }, { type: 'object' }],
        } as any,
      },
    })

    expect(result).toEqual({
      type: 'object',
      properties: {
        spec: {
          allOf: [{ type: 'object' }, { type: 'object' }],
        },
      },
    })
  })
})
