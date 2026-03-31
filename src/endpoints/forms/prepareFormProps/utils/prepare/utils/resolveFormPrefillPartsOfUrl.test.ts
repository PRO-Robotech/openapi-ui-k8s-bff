import { resolveFormPrefillPartsOfUrl } from './resolveFormPrefillPartsOfUrl'

describe('resolveFormPrefillPartsOfUrl', () => {
  const partsOfUrl = ['', 'openapi-ui', 'default', 'incloud-web']

  test('returns original prefill when partsOfUrl is missing', () => {
    const prefill: any = {
      spec: {
        customizationId: 'cid',
        values: [{ path: ['metadata', 'name'], value: 'svc-{3}' }],
      },
    }

    expect(resolveFormPrefillPartsOfUrl({ prefill })).toBe(prefill)
  })

  test('resolves placeholders in canonical entry values and keeps path unchanged', () => {
    const prefill: any = {
      spec: {
        customizationId: 'cid',
        values: [
          { path: ['metadata', 'name'], value: 'svc-{3}' },
          {
            path: ['spec'],
            value: {
              selector: { app: 'app-{3}' },
              ports: [{ name: 'http-{2}', port: 80 }],
            },
          },
        ],
      },
    }

    expect(resolveFormPrefillPartsOfUrl({ prefill, partsOfUrl })).toEqual({
      spec: {
        customizationId: 'cid',
        values: [
          { path: ['metadata', 'name'], value: 'svc-incloud-web' },
          {
            path: ['spec'],
            value: {
              selector: { app: 'app-incloud-web' },
              ports: [{ name: 'http-default', port: 80 }],
            },
          },
        ],
      },
    })
  })

  test('replaces missing indexes with empty strings', () => {
    const prefill: any = {
      spec: {
        customizationId: 'cid',
        values: [{ path: ['metadata', 'name'], value: 'svc-{9}' }],
      },
    }

    expect(resolveFormPrefillPartsOfUrl({ prefill, partsOfUrl })).toEqual({
      spec: {
        customizationId: 'cid',
        values: [{ path: ['metadata', 'name'], value: 'svc-' }],
      },
    })
  })

  test('does not modify non-string scalar values', () => {
    const prefill: any = {
      spec: {
        customizationId: 'cid',
        values: [
          {
            path: ['spec'],
            value: {
              enabled: true,
              retries: 3,
              labels: null,
            },
          },
        ],
      },
    }

    expect(resolveFormPrefillPartsOfUrl({ prefill, partsOfUrl })).toEqual(prefill)
  })

  test('resolves placeholders in object-style values', () => {
    const prefill: any = {
      spec: {
        customizationId: 'cid',
        values: {
          metadata: {
            name: 'svc-{3}',
          },
          spec: {
            selector: {
              app: 'app-{3}',
            },
            ports: [{ name: 'http-{2}', port: 80 }],
          },
        },
      },
    }

    expect(resolveFormPrefillPartsOfUrl({ prefill, partsOfUrl })).toEqual({
      spec: {
        customizationId: 'cid',
        values: {
          metadata: {
            name: 'svc-incloud-web',
          },
          spec: {
            selector: {
              app: 'app-incloud-web',
            },
            ports: [{ name: 'http-default', port: 80 }],
          },
        },
      },
    })
  })
})
