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

  it('merges override paths, prefill-derived persisted paths, and resolves prefill templates', () => {
    const result = finalizePreparedForm({
      data: {
        type: 'apis',
        apiGroup: 'incloud.prorobotech.com',
        apiVersion: 'v1',
        plural: 'demoapps',
        prefillValuesSchema: {
          spec: {
            labels: {
              env: 'dev',
            },
          },
        },
      },
      bodyParametersSchema: {
        type: 'object',
        required: ['spec'],
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
              image: {
                type: 'string',
              },
            },
          },
        },
      },
      kind: 'DemoApp',
      isNamespaced: true,
      formsOverridesData: {
        items: [
          {
            spec: {
              customizationId: 'demoapp',
              strategy: 'merge',
              schema: {
                properties: {
                  spec: {
                    type: 'object',
                    properties: {
                      protocol: {
                        type: 'string',
                        default: 'TCP',
                      },
                    },
                  },
                },
                required: ['protocol'],
              },
              hidden: [['spec', 'hiddenField']],
              expanded: [['spec', 'protocol']],
              persisted: [['spec', 'protocol']],
              sort: [['spec', 'protocol']],
              forceViewMode: 'OpenAPI',
            },
          },
        ],
      } as any,
      formsPrefillsData: {
        items: [
          {
            spec: {
              customizationId: 'demoapp',
              values: {
                spec: {
                  image: 'repo/{2}',
                },
              },
            },
          },
        ],
      } as any,
      customizationId: 'demoapp',
      customizationIdPrefill: undefined,
      partsOfUrl: ['openapi-ui', 'default', 'incloud-web', 'forms', 'apis', 'incloud.prorobotech.com', 'v1', 'demoapps'],
      namespacesData: {
        items: [{ metadata: { name: 'incloud-web' } }],
      } as any,
      source: 'v3',
      status: 'success',
    })

    expect(result).toEqual(
      expect.objectContaining({
        result: 'success',
        forceViewMode: 'OpenAPI',
        hiddenPaths: [['spec', 'hiddenField']],
        sortPaths: [['spec', 'protocol']],
        kind: 'DemoApp',
        isNamespaced: true,
        namespacesData: ['incloud-web'],
        formPrefills: {
          spec: {
            customizationId: 'demoapp',
            values: [{ path: ['spec', 'image'], value: 'repo/incloud-web' }],
          },
        },
      }),
    )

    expect(result.result).toBe('success')

    if (result.result === 'success') {
      expect(result.properties).toEqual(
        expect.objectContaining({
          spec: expect.objectContaining({
            properties: expect.objectContaining({
              protocol: {
                type: 'string',
                default: 'TCP',
              },
              labels: expect.objectContaining({
                type: 'object',
                additionalProperties: {
                  type: 'string',
                },
                properties: {
                  env: {
                    type: 'string',
                    default: 'dev',
                    isAdditionalProperties: true,
                  },
                },
              }),
            }),
          }),
        }),
      )

      expect(result.required).toEqual(['spec', 'protocol'])
      expect(result.expandedPaths).toEqual(
        expect.arrayContaining([
          ['spec', 'protocol'],
          ['spec', 'labels', 'env'],
        ]),
      )
      expect(result.persistedPaths).toEqual(
        expect.arrayContaining([
          ['spec', 'protocol'],
          ['spec'],
          ['spec', 'labels'],
          ['spec', 'labels', 'env'],
          ['spec', 'image'],
        ]),
      )
    }
  })
})
