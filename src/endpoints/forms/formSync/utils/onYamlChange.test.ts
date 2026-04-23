import { onYamlChange } from './onYamlChange'

describe('onYamlChange', () => {
  it('renames nodeName back to the form key and converts quota strings to numbers', () => {
    const values = {
      nodeName: 'worker-1',
      metadata: {
        name: 'demoapp-test',
      },
      spec: {
        cpu: '500m',
        memory: '2Gi',
        timeout: '30s',
      },
    }

    const properties = {
      spec: {
        type: 'object',
        properties: {
          cpu: { type: 'rangeInputCpu' },
          memory: { type: 'rangeInputMemory' },
          timeout: { type: 'string' },
        },
      },
    } as any

    const result = onYamlChange({
      values: values as any,
      properties,
    })

    expect(result).toEqual({
      nodeNameBecauseOfSuddenBug: 'worker-1',
      metadata: {
        name: 'demoapp-test',
      },
      spec: {
        cpu: 0.5,
        memory: 2.1,
        timeout: '30s',
      },
    })
  })

  it('returns undefined when yaml values are missing', () => {
    const result = onYamlChange({
      values: undefined as any,
      properties: {} as any,
    })

    expect(result).toBeUndefined()
  })
})
