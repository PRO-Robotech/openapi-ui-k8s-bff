import { checkV3SchemaSupport, UNSUPPORTED_V3_FORM_KEYWORDS } from './checkV3SchemaSupport'

describe('checkV3SchemaSupport', () => {
  it('accepts schemas that use only the currently supported subset', () => {
    const schema = {
      type: 'object',
      properties: {
        spec: {
          type: 'object',
          properties: {
            replicas: {
              type: 'integer',
              default: 3,
              description: 'Desired replicas',
              nullable: true,
            },
            protocol: {
              type: 'string',
              enum: ['TCP', 'UDP'],
            },
            ports: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
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
        },
      },
    }

    expect(checkV3SchemaSupport(schema)).toEqual({
      supported: true,
      issues: [],
    })
  })

  it('tolerates metadata keywords like example, default, enum, description, nullable, deprecated', () => {
    const schema = {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          default: 'nginx:latest',
          example: 'registry.example.com/app:v1.2.3',
          description: 'Container image',
        },
        replicas: {
          type: 'integer',
          default: 3,
          example: 5,
          deprecated: true,
        },
        protocol: {
          type: 'string',
          enum: ['TCP', 'UDP'],
          nullable: true,
        },
      },
    }

    expect(checkV3SchemaSupport(schema)).toEqual({
      supported: true,
      issues: [],
    })
  })

  it('flags unsupported keyword at the root level', () => {
    const schema = {
      type: 'object',
      oneOf: [{ type: 'string' }, { type: 'integer' }],
    }

    expect(checkV3SchemaSupport(schema)).toEqual({
      supported: false,
      issues: [{ keyword: 'oneOf', path: [] }],
    })
  })

  it('flags unsupported keyword in nested object properties', () => {
    const schema = {
      type: 'object',
      properties: {
        spec: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              anyOf: [{ const: 'Auto' }, { const: 'Manual' }],
            },
          },
        },
      },
    }

    expect(checkV3SchemaSupport(schema)).toEqual({
      supported: false,
      issues: [{ keyword: 'anyOf', path: ['spec', 'mode'] }],
    })
  })

  it('flags unsupported keyword in array item schemas', () => {
    const schema = {
      type: 'object',
      properties: {
        spec: {
          type: 'object',
          properties: {
            containers: {
              type: 'array',
              items: {
                type: 'object',
                allOf: [{ type: 'object' }, { type: 'object' }],
              },
            },
          },
        },
      },
    }

    expect(checkV3SchemaSupport(schema)).toEqual({
      supported: false,
      issues: [{ keyword: 'allOf', path: ['spec', 'containers', '*'] }],
    })
  })

  it('flags unsupported keyword in additionalProperties schemas', () => {
    const schema = {
      type: 'object',
      properties: {
        spec: {
          type: 'object',
          properties: {
            labels: {
              type: 'object',
              additionalProperties: {
                type: 'string',
                discriminator: { propertyName: 'kind' },
              },
            },
          },
        },
      },
    }

    expect(checkV3SchemaSupport(schema)).toEqual({
      supported: false,
      issues: [{ keyword: 'discriminator', path: ['spec', 'labels', '<additionalProperties>'] }],
    })
  })

  it('collects multiple issues in traversal order', () => {
    const schema = {
      type: 'object',
      properties: {
        spec: {
          type: 'object',
          properties: {
            strategy: {
              not: { type: 'null' },
            },
            mode: {
              oneOf: [{ type: 'string' }, { type: 'integer' }],
            },
          },
        },
      },
    }

    expect(checkV3SchemaSupport(schema)).toEqual({
      supported: false,
      issues: [
        { keyword: 'not', path: ['spec', 'strategy'] },
        { keyword: 'oneOf', path: ['spec', 'mode'] },
      ],
    })
  })

  it('keeps the unsupported keyword list explicit and stable', () => {
    expect(UNSUPPORTED_V3_FORM_KEYWORDS).toEqual(['oneOf', 'anyOf', 'allOf', 'not', 'discriminator'])
  })
})
