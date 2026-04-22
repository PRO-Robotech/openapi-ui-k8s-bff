import { finalizePreparedForm } from './finalizePreparedForm'

describe('finalizePreparedForm', () => {
  it('preserves normalized schema defaults and required fields in the prepared response', () => {
    const result = finalizePreparedForm({
      data: {
        type: 'apis',
        apiGroup: 'incloud.prorobotech.com',
        apiVersion: 'v1',
        plural: 'demoapps',
      },
      bodyParametersSchema: {
        type: 'object',
        required: ['spec'],
        properties: {
          spec: {
            type: 'object',
            properties: {
              replicas: {
                type: 'integer',
                default: 3,
              },
              protocol: {
                type: 'string',
                enum: ['TCP', 'UDP'],
                default: 'TCP',
              },
            },
          },
        },
      },
      kind: 'DemoApp',
      isNamespaced: true,
      formsOverridesData: undefined,
      formsPrefillsData: undefined,
      customizationId: undefined,
      customizationIdPrefill: undefined,
      partsOfUrl: ['openapi-ui', 'default', 'incloud-web', 'forms', 'apis', 'incloud.prorobotech.com', 'v1', 'demoapps'],
      namespacesData: {
        items: [
          { metadata: { name: 'incloud-web' } },
          { metadata: { name: 'practice' } },
        ],
      } as any,
      source: 'v3',
      status: 'success',
    })

    expect(result).toEqual({
      result: 'success',
      properties: {
        spec: {
          type: 'object',
          properties: {
            replicas: {
              type: 'integer',
              default: 3,
            },
            protocol: {
              type: 'string',
              enum: ['TCP', 'UDP'],
              default: 'TCP',
            },
          },
        },
      },
      required: ['spec'],
      hiddenPaths: [],
      expandedPaths: [],
      persistedPaths: [],
      sortPaths: undefined,
      forceViewMode: undefined,
      kind: 'DemoApp',
      isNamespaced: true,
      formPrefills: undefined,
      namespacesData: ['incloud-web', 'practice'],
    })
  })
})
