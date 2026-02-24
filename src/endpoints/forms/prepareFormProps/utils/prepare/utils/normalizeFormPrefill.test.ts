import { normalizeFormPrefill } from './normalizeFormPrefill'

describe('normalizeFormPrefill', () => {
  test('returns undefined for empty input', () => {
    expect(normalizeFormPrefill(undefined)).toBeUndefined()
  })

  test('keeps canonical values[] shape and normalizes path segments', () => {
    const input: any = {
      spec: {
        customizationId: 'cid',
        values: [
          { path: ['metadata', 'name'], value: 'foo-' },
          { path: ['spec', 'ports', '0', 'name'], value: 'http' },
          { path: ['spec', 'hosts', '*', 'kind'], value: 'bar' },
        ],
      },
    }

    const normalized = normalizeFormPrefill(input)

    expect(normalized).toEqual({
      spec: {
        customizationId: 'cid',
        values: [
          { path: ['metadata', 'name'], value: 'foo-' },
          { path: ['spec', 'ports', 0, 'name'], value: 'http' },
          { path: ['spec', 'hosts', '*', 'kind'], value: 'bar' },
        ],
      },
    })
  })

  test('flattens object-style values into canonical values[]', () => {
    const input: any = {
      spec: {
        customizationId: 'cid',
        values: {
          metadata: {
            name: 'foo-',
          },
          spec: {
            hosts: {
              '*': {
                kind: 'bar',
              },
            },
            ports: [{ name: 'http', port: 80 }],
          },
        },
      },
    }

    const normalized = normalizeFormPrefill(input)

    expect(normalized).toEqual({
      spec: {
        customizationId: 'cid',
        values: [
          { path: ['metadata', 'name'], value: 'foo-' },
          { path: ['spec', 'hosts', '*', 'kind'], value: 'bar' },
          { path: ['spec', 'ports', 0, 'name'], value: 'http' },
          { path: ['spec', 'ports', 0, 'port'], value: 80 },
        ],
      },
    })
  })

  test('preserves empty object/array leafs at non-root paths', () => {
    const input: any = {
      spec: {
        customizationId: 'cid',
        values: {
          spec: {
            emptyMap: {},
            emptyList: [],
          },
        },
      },
    }

    const normalized = normalizeFormPrefill(input)

    expect(normalized).toEqual({
      spec: {
        customizationId: 'cid',
        values: [
          { path: ['spec', 'emptyMap'], value: {} },
          { path: ['spec', 'emptyList'], value: [] },
        ],
      },
    })
  })

  test('handles malformed canonical-like arrays by flattening as regular array values', () => {
    const input: any = {
      spec: {
        customizationId: 'cid',
        values: ['a', 'b'],
      },
    }

    const normalized = normalizeFormPrefill(input)

    expect(normalized).toEqual({
      spec: {
        customizationId: 'cid',
        values: [
          { path: [0], value: 'a' },
          { path: [1], value: 'b' },
        ],
      },
    })
  })
})

