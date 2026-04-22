import { onValuesChange } from './onValuesChange'

describe('onValuesChange', () => {
  it('cleans empty values, preserves persisted empties, renames broken fields, and normalizes quotas', () => {
    const values = {
      nodeNameBecauseOfSuddenBug: 'worker-1',
      metadata: {
        labels: {},
      },
      spec: {
        cpu: 0.5,
        memory: 2,
        script: 'echo hello\nexit 0',
        emptyString: '',
        emptyArray: [],
        zero: 0,
        enabled: false,
      },
    }

    const properties = {
      spec: {
        type: 'object',
        properties: {
          cpu: { type: 'rangeInputCpu' },
          memory: { type: 'rangeInputMemory' },
          script: { type: 'multilineString' },
          emptyString: { type: 'string' },
          emptyArray: { type: 'array', items: { type: 'string' } },
          zero: { type: 'integer' },
          enabled: { type: 'boolean' },
        },
      },
      metadata: {
        type: 'object',
        properties: {
          labels: {
            type: 'object',
            additionalProperties: { type: 'string' },
          },
        },
      },
    } as any

    const result = onValuesChange({
      values,
      persistedKeys: [
        ['metadata', 'labels'],
        ['spec', 'emptyArray'],
      ] as any,
      properties,
    })

    expect(result).toEqual({
      nodeName: 'worker-1',
      metadata: {
        labels: {},
      },
      spec: {
        cpu: '0.5',
        memory: '2G',
        script: 'echo hello\nexit 0',
        emptyArray: [],
        zero: 0,
        enabled: false,
      },
    })
  })

  it('drops null and undefined values when they are not persisted', () => {
    const result = onValuesChange({
      values: {
        spec: {
          nullable: null,
          missing: undefined,
          keepMe: 'value',
        },
      },
      persistedKeys: [],
      properties: {
        spec: {
          type: 'object',
          properties: {
            nullable: { type: 'string' },
            missing: { type: 'string' },
            keepMe: { type: 'string' },
          },
        },
      } as any,
    })

    expect(result).toEqual({
      spec: {
        keepMe: 'value',
      },
    })
  })
})
