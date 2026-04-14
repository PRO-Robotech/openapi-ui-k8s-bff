import { OpenAPIV2 } from 'openapi-types'
import { mergeV3Defaults } from './mergeV3Defaults'

type TV2Props = Record<string, OpenAPIV2.SchemaObject>

const makeV2 = (specProperties: TV2Props): TV2Props => ({
  spec: { type: 'object', properties: specProperties },
})

const makeV3Doc = (kind: string, specProperties: Record<string, unknown>) => ({
  components: {
    schemas: {
      [`com.example.v1.${kind}`]: {
        type: 'object',
        properties: {
          spec: {
            type: 'object',
            properties: specProperties,
          },
        },
      },
    },
  },
})

const getSpec = (v2: TV2Props): TV2Props => v2.spec.properties as TV2Props

describe('mergeV3Defaults', () => {
  describe('graceful degradation', () => {
    it('is a no-op when v3Doc is undefined', () => {
      const v2Properties = makeV2({ replicas: { type: 'integer' } })
      const before = JSON.stringify(v2Properties)

      mergeV3Defaults({ v2Properties, v3Doc: undefined, kind: 'DemoApp' })

      expect(JSON.stringify(v2Properties)).toBe(before)
    })

    it('is a no-op when kind is undefined', () => {
      const v2Properties = makeV2({ replicas: { type: 'integer' } })
      const v3Doc = makeV3Doc('DemoApp', { replicas: { type: 'integer', default: 3 } })
      const before = JSON.stringify(v2Properties)

      mergeV3Defaults({ v2Properties, v3Doc, kind: undefined })

      expect(JSON.stringify(v2Properties)).toBe(before)
    })

    it('is a no-op when kind does not match any v3 schema', () => {
      const v2Properties = makeV2({ replicas: { type: 'integer' } })
      const v3Doc = makeV3Doc('DemoApp', { replicas: { type: 'integer', default: 3 } })

      mergeV3Defaults({ v2Properties, v3Doc, kind: 'NonExistent' })

      expect(getSpec(v2Properties).replicas).not.toHaveProperty('default')
    })

    it('is a no-op when v3Doc has no components', () => {
      const v2Properties = makeV2({ replicas: { type: 'integer' } })

      mergeV3Defaults({ v2Properties, v3Doc: {}, kind: 'DemoApp' })

      expect(getSpec(v2Properties).replicas).not.toHaveProperty('default')
    })
  })

  describe('leaf field defaults', () => {
    it('merges a string default', () => {
      const v2Properties = makeV2({ protocol: { type: 'string' } })
      const v3Doc = makeV3Doc('DemoApp', { protocol: { type: 'string', default: 'TCP' } })

      mergeV3Defaults({ v2Properties, v3Doc, kind: 'DemoApp' })

      expect(getSpec(v2Properties).protocol.default).toBe('TCP')
    })

    it('merges a number default', () => {
      const v2Properties = makeV2({ replicas: { type: 'integer' } })
      const v3Doc = makeV3Doc('DemoApp', { replicas: { type: 'integer', default: 3 } })

      mergeV3Defaults({ v2Properties, v3Doc, kind: 'DemoApp' })

      expect(getSpec(v2Properties).replicas.default).toBe(3)
    })

    it('merges a boolean default', () => {
      const v2Properties = makeV2({ enableMetrics: { type: 'boolean' } })
      const v3Doc = makeV3Doc('DemoApp', { enableMetrics: { type: 'boolean', default: true } })

      mergeV3Defaults({ v2Properties, v3Doc, kind: 'DemoApp' })

      expect(getSpec(v2Properties).enableMetrics.default).toBe(true)
    })

    it('merges default 0 (falsy number)', () => {
      const v2Properties = makeV2({ minReady: { type: 'integer' } })
      const v3Doc = makeV3Doc('DemoApp', { minReady: { type: 'integer', default: 0 } })

      mergeV3Defaults({ v2Properties, v3Doc, kind: 'DemoApp' })

      expect(getSpec(v2Properties).minReady.default).toBe(0)
    })

    it('merges default false (falsy boolean)', () => {
      const v2Properties = makeV2({ debug: { type: 'boolean' } })
      const v3Doc = makeV3Doc('DemoApp', { debug: { type: 'boolean', default: false } })

      mergeV3Defaults({ v2Properties, v3Doc, kind: 'DemoApp' })

      expect(getSpec(v2Properties).debug.default).toBe(false)
    })

    it('merges default empty string', () => {
      const v2Properties = makeV2({ label: { type: 'string' } })
      const v3Doc = makeV3Doc('DemoApp', { label: { type: 'string', default: '' } })

      mergeV3Defaults({ v2Properties, v3Doc, kind: 'DemoApp' })

      expect(getSpec(v2Properties).label.default).toBe('')
    })

    it('merges multiple defaults at once', () => {
      const v2Properties = makeV2({
        replicas: { type: 'integer' },
        protocol: { type: 'string' },
        enabled: { type: 'boolean' },
      })
      const v3Doc = makeV3Doc('DemoApp', {
        replicas: { type: 'integer', default: 3 },
        protocol: { type: 'string', default: 'TCP' },
        enabled: { type: 'boolean', default: true },
      })

      mergeV3Defaults({ v2Properties, v3Doc, kind: 'DemoApp' })

      const spec = getSpec(v2Properties)
      expect(spec.replicas.default).toBe(3)
      expect(spec.protocol.default).toBe('TCP')
      expect(spec.enabled.default).toBe(true)
    })
  })

  describe('does not overwrite existing defaults', () => {
    it('preserves v2 default when it already exists', () => {
      const v2Properties = makeV2({ replicas: { type: 'integer', default: 5 } })
      const v3Doc = makeV3Doc('DemoApp', { replicas: { type: 'integer', default: 3 } })

      mergeV3Defaults({ v2Properties, v3Doc, kind: 'DemoApp' })

      expect(getSpec(v2Properties).replicas.default).toBe(5)
    })
  })

  describe('skips non-leaf defaults', () => {
    it('skips object defaults', () => {
      const v2Properties = makeV2({ config: { type: 'object' } })
      const v3Doc = makeV3Doc('DemoApp', { config: { type: 'object', default: { foo: 'bar' } } })

      mergeV3Defaults({ v2Properties, v3Doc, kind: 'DemoApp' })

      expect(getSpec(v2Properties).config).not.toHaveProperty('default')
    })

    it('skips array defaults with non-string items', () => {
      const v2Properties = makeV2({ ids: { type: 'array' } })
      const v3Doc = makeV3Doc('DemoApp', { ids: { type: 'array', default: [1, 2, 3] } })

      mergeV3Defaults({ v2Properties, v3Doc, kind: 'DemoApp' })

      expect(getSpec(v2Properties).ids).not.toHaveProperty('default')
    })

    it('skips array defaults with mixed items', () => {
      const v2Properties = makeV2({ mixed: { type: 'array' } })
      const v3Doc = makeV3Doc('DemoApp', { mixed: { type: 'array', default: ['a', 1] } })

      mergeV3Defaults({ v2Properties, v3Doc, kind: 'DemoApp' })

      expect(getSpec(v2Properties).mixed).not.toHaveProperty('default')
    })

    it('skips array defaults on non-array v2 type', () => {
      const v2Properties = makeV2({ field: { type: 'string' } })
      const v3Doc = makeV3Doc('DemoApp', { field: { type: 'string', default: ['a', 'b'] } })

      mergeV3Defaults({ v2Properties, v3Doc, kind: 'DemoApp' })

      expect(getSpec(v2Properties).field).not.toHaveProperty('default')
    })
  })

  describe('string array defaults (listInput leaf fields)', () => {
    it('merges string array default on array-typed field', () => {
      const v2Properties = makeV2({ protocols: { type: 'array' } })
      const v3Doc = makeV3Doc('DemoApp', { protocols: { type: 'array', default: ['TCP', 'UDP'] } })

      mergeV3Defaults({ v2Properties, v3Doc, kind: 'DemoApp' })

      expect(getSpec(v2Properties).protocols.default).toEqual(['TCP', 'UDP'])
    })

    it('merges empty string array default', () => {
      const v2Properties = makeV2({ tags: { type: 'array' } })
      const v3Doc = makeV3Doc('DemoApp', { tags: { type: 'array', default: [] } })

      mergeV3Defaults({ v2Properties, v3Doc, kind: 'DemoApp' })

      expect(getSpec(v2Properties).tags.default).toEqual([])
    })

    it('merges single-element string array default', () => {
      const v2Properties = makeV2({ modes: { type: 'array' } })
      const v3Doc = makeV3Doc('DemoApp', { modes: { type: 'array', default: ['default'] } })

      mergeV3Defaults({ v2Properties, v3Doc, kind: 'DemoApp' })

      expect(getSpec(v2Properties).modes.default).toEqual(['default'])
    })
  })

  describe('recursive merge into nested objects', () => {
    it('merges defaults into nested spec.config.timeout', () => {
      const v2Properties = makeV2({
        config: {
          type: 'object',
          properties: {
            timeout: { type: 'integer' },
            retries: { type: 'integer' },
          },
        },
      })
      const v3Doc = makeV3Doc('DemoApp', {
        config: {
          type: 'object',
          properties: {
            timeout: { type: 'integer', default: 30 },
            retries: { type: 'integer', default: 3 },
          },
        },
      })

      mergeV3Defaults({ v2Properties, v3Doc, kind: 'DemoApp' })

      const configProps = getSpec(v2Properties).config.properties as TV2Props
      expect(configProps.timeout.default).toBe(30)
      expect(configProps.retries.default).toBe(3)
    })
  })

  describe('schema key matching', () => {
    it('matches kind by last segment of dotted key', () => {
      const v2Properties = makeV2({ port: { type: 'integer' } })
      const v3Doc = {
        components: {
          schemas: {
            'io.k8s.custom.deeply.nested.v1.MyResource': {
              type: 'object',
              properties: {
                spec: {
                  type: 'object',
                  properties: {
                    port: { type: 'integer', default: 443 },
                  },
                },
              },
            },
          },
        },
      }

      mergeV3Defaults({ v2Properties, v3Doc, kind: 'MyResource' })

      expect(getSpec(v2Properties).port.default).toBe(443)
    })
  })

  describe('fields without v3 counterpart', () => {
    it('leaves v2-only fields untouched', () => {
      const v2Properties = makeV2({
        replicas: { type: 'integer' },
        customField: { type: 'string' },
      })
      const v3Doc = makeV3Doc('DemoApp', {
        replicas: { type: 'integer', default: 3 },
      })

      mergeV3Defaults({ v2Properties, v3Doc, kind: 'DemoApp' })

      const spec = getSpec(v2Properties)
      expect(spec.replicas.default).toBe(3)
      expect(spec.customField).not.toHaveProperty('default')
    })
  })
})
