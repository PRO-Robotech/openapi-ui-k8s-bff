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
