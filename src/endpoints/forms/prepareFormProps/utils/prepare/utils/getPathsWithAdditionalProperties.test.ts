import { getPathsWithAdditionalProperties } from './getPathsWithAdditionalProperties'

describe('getPathsWithAdditionalProperties', () => {
  it('collects data paths for schema nodes with additionalProperties', () => {
    const result = getPathsWithAdditionalProperties({
      properties: {
        spec: {
          type: 'object',
          properties: {
            labels: {
              type: 'object',
              additionalProperties: {
                type: 'string',
              },
            },
          },
        },
        data: {
          type: 'object',
          additionalProperties: true,
        },
      },
    })

    expect(result).toEqual([
      ['spec', 'properties', 'labels'],
      ['data'],
    ])
  })

  it('does not recurse through non-schema metadata fields', () => {
    const result = getPathsWithAdditionalProperties({
      properties: {
        spec: {
          type: 'object',
          description: 'Spec root',
          required: ['labels'],
          enum: ['unused'],
          customProps: {
            additionalProperties: true,
          },
          properties: {
            labels: {
              type: 'object',
              additionalProperties: true,
            },
          },
        } as any,
      },
    })

    expect(result).toEqual([['spec', 'properties', 'labels']])
  })
})
