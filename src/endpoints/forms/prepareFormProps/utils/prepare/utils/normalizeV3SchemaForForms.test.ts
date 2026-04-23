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

  it('merges compatible multi-entry allOf object schemas into a regular form node', () => {
    const result = normalizeV3SchemaForForms({
      type: 'object',
      properties: {
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
                protocol: {
                  type: 'string',
                  enum: ['TCP', 'UDP'],
                },
              },
              required: ['replicas'],
            } as any,
            {
              type: 'object',
              properties: {
                protocol: {
                  type: 'string',
                  enum: ['UDP'],
                },
                image: {
                  type: 'string',
                  example: 'registry.example.com/widget:v1',
                },
              },
              required: ['image'],
            } as any,
          ],
        } as any,
      },
    })

    expect(result).toEqual({
      type: 'object',
      properties: {
        spec: {
          type: 'object',
          description: 'Desired widget spec',
          properties: {
            replicas: {
              type: 'integer',
              default: 3,
            },
            protocol: {
              type: 'string',
              enum: ['UDP'],
            },
            image: {
              type: 'string',
              example: 'registry.example.com/widget:v1',
            },
          },
          required: ['replicas', 'image'],
        },
      },
    })
  })

  it('narrows nullable when not every allOf branch allows null', () => {
    const result = normalizeV3SchemaForForms({
      type: 'object',
      properties: {
        config: {
          allOf: [
            {
              type: 'string',
              nullable: true,
            } as any,
            {
              type: 'string',
            } as any,
          ],
        } as any,
      },
    })

    expect(result).toEqual({
      type: 'object',
      properties: {
        config: {
          type: 'string',
        },
      },
    })
  })

  it('preserves conflicting multi-entry allOf so unsupported policy can still catch it', () => {
    const result = normalizeV3SchemaForForms({
      type: 'object',
      properties: {
        spec: {
          allOf: [
            {
              type: 'object',
              properties: {
                replicas: {
                  type: 'integer',
                },
              },
            },
            {
              type: 'string',
            },
          ],
        } as any,
      },
    })

    expect(result).toEqual({
      type: 'object',
      properties: {
        spec: {
          allOf: [
            {
              type: 'object',
              properties: {
                replicas: {
                  type: 'integer',
                },
              },
            },
            {
              type: 'string',
            },
          ],
        },
      },
    })
  })
})
