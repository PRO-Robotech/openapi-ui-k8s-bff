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

  it('preserves pattern, string length, and numeric range validation keywords', () => {
    const result = normalizeV3SchemaForForms({
      type: 'object',
      properties: {
        url: {
          type: 'string',
          pattern: '^https?://',
          minLength: 8,
          maxLength: 2048,
        },
        port: {
          type: 'integer',
          minimum: 1,
          maximum: 65535,
        },
      },
    })

    expect(result).toEqual({
      type: 'object',
      properties: {
        url: {
          type: 'string',
          pattern: '^https?://',
          minLength: 8,
          maxLength: 2048,
        },
        port: {
          type: 'integer',
          minimum: 1,
          maximum: 65535,
        },
      },
    })
  })

  it('narrows minLength and maxLength across compatible allOf branches', () => {
    const result = normalizeV3SchemaForForms({
      type: 'object',
      properties: {
        name: {
          allOf: [
            {
              type: 'string',
              minLength: 1,
              maxLength: 63,
            } as any,
            {
              type: 'string',
              minLength: 3,
              maxLength: 20,
            } as any,
          ],
        } as any,
      },
    })

    expect(result).toEqual({
      type: 'object',
      properties: {
        name: {
          type: 'string',
          minLength: 3,
          maxLength: 20,
        },
      },
    })
  })

  it('narrows minimum and maximum across compatible allOf branches', () => {
    const result = normalizeV3SchemaForForms({
      type: 'object',
      properties: {
        port: {
          allOf: [
            {
              type: 'integer',
              minimum: 1,
              maximum: 65535,
            } as any,
            {
              type: 'integer',
              minimum: 1024,
              maximum: 8080,
            } as any,
          ],
        } as any,
      },
    })

    expect(result).toEqual({
      type: 'object',
      properties: {
        port: {
          type: 'integer',
          minimum: 1024,
          maximum: 8080,
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

  it('lowers supported oneOf required-groups into normalized form metadata', () => {
    const result = normalizeV3SchemaForForms({
      type: 'object',
      properties: {
        spec: {
          type: 'object',
          properties: {
            command: { type: 'string' },
            shell: { type: 'string' },
          },
          oneOf: [
            { required: ['command'] } as any,
            { required: ['shell'] } as any,
          ],
        } as any,
      },
    })

    expect(result).toEqual({
      type: 'object',
      properties: {
        spec: {
          type: 'object',
          properties: {
            command: { type: 'string' },
            shell: { type: 'string' },
          },
          oneOfRequiredGroups: [['command'], ['shell']],
        },
      },
    })
  })

  it('lowers oneOf branches with enum matchers and not.required into normalized branch metadata', () => {
    const result = normalizeV3SchemaForForms({
      type: 'object',
      properties: {
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
            } as any,
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
    })
  })

  it('keeps unsupported oneOf branches untouched so policy can still catch them', () => {
    const result = normalizeV3SchemaForForms({
      type: 'object',
      properties: {
        spec: {
          type: 'object',
          properties: {
            command: { type: 'string' },
            shell: { type: 'string' },
          },
          oneOf: [
            { required: ['command'] } as any,
            {
              required: ['shell'],
              properties: {
                shell: {
                  minLength: 1,
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
        spec: {
          type: 'object',
          properties: {
            command: { type: 'string' },
            shell: { type: 'string' },
          },
          oneOf: [
            { required: ['command'] },
            {
              required: ['shell'],
              properties: {
                shell: {
                  minLength: 1,
                },
              },
            },
          ],
        },
      },
    })
  })

  it('keeps oneOf branches with unsupported not untouched so policy can still catch them', () => {
    const result = normalizeV3SchemaForForms({
      type: 'object',
      properties: {
        spec: {
          type: 'object',
          required: ['type'],
          properties: {
            type: {
              type: 'string',
              enum: ['service', 'url'],
            },
            service: { type: 'object' },
            url: { type: 'string' },
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
            } as any,
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
          required: ['type'],
          properties: {
            type: {
              type: 'string',
              enum: ['service', 'url'],
            },
            service: { type: 'object' },
            url: { type: 'string' },
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
    })
  })

  it('does not lower oneOf required-groups for object nodes without declared properties', () => {
    const result = normalizeV3SchemaForForms({
      type: 'object',
      properties: {
        spec: {
          type: 'object',
          oneOf: [{ required: ['command'] } as any, { required: ['shell'] } as any],
        } as any,
      },
    })

    expect(result).toEqual({
      type: 'object',
      properties: {
        spec: {
          type: 'object',
          oneOf: [{ required: ['command'] }, { required: ['shell'] }],
        },
      },
    })
  })

  it('preserves conflicting oneOfRequiredGroups coming from different allOf branches', () => {
    const result = normalizeV3SchemaForForms({
      type: 'object',
      properties: {
        spec: {
          allOf: [
            {
              type: 'object',
              properties: {
                command: {
                  type: 'string',
                },
              },
              oneOf: [{ required: ['command'] }] as any,
            } as any,
            {
              type: 'object',
              properties: {
                shell: {
                  type: 'string',
                },
              },
              oneOf: [{ required: ['shell'] }] as any,
            } as any,
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
                command: {
                  type: 'string',
                },
              },
              oneOfRequiredGroups: [['command']],
            },
            {
              type: 'object',
              properties: {
                shell: {
                  type: 'string',
                },
              },
              oneOfRequiredGroups: [['shell']],
            },
          ],
        },
      },
    })
  })

  it('warns in development when unknown schema keywords are encountered', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const previousNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    normalizeV3SchemaForForms({
      type: 'object',
      properties: {
        spec: {
          type: 'string',
          format: 'date-time',
        } as any,
      },
    })

    expect(warnSpy).toHaveBeenCalledWith(
      '[openapi-v3-normalize]: unknown schema keyword(s) encountered during form normalization',
      {
        unknownKeys: ['format'],
      },
    )

    process.env.NODE_ENV = previousNodeEnv
    warnSpy.mockRestore()
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

  it('preserves impossible string length allOf constraints so unsupported policy can still catch them', () => {
    const result = normalizeV3SchemaForForms({
      type: 'object',
      properties: {
        name: {
          allOf: [
            {
              type: 'string',
              minLength: 10,
            },
            {
              type: 'string',
              maxLength: 5,
            },
          ],
        } as any,
      },
    })

    expect(result).toEqual({
      type: 'object',
      properties: {
        name: {
          allOf: [
            {
              type: 'string',
              minLength: 10,
            },
            {
              type: 'string',
              maxLength: 5,
            },
          ],
        },
      },
    })
  })
})
