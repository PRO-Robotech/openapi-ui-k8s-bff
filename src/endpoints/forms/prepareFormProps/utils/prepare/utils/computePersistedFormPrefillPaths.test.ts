import { removeEmptyFormValues } from 'src/endpoints/forms/formSync/utils/removeAndRename'
import { normalizeFormPrefill } from './normalizeFormPrefill'
import { computePersistedFormPrefillPaths } from './computePersistedFormPrefillPaths'

describe('computePersistedFormPrefillPaths', () => {
  it('expands canonical entry values into leaf persisted paths', () => {
    const normalizedPrefill = normalizeFormPrefill({
      spec: {
        customizationId: 'cid',
        values: [
          {
            path: ['metadata'],
            value: {
              name: 'example-service',
              namespace: 'default',
            },
          },
          {
            path: ['spec'],
            value: {
              ports: [
                {
                  name: 'http',
                  port: 80,
                  protocol: 'TCP',
                  targetPort: 8080,
                },
              ],
              selector: {
                app: 'my-app',
              },
              type: 'ClusterIP',
            },
          },
        ],
      },
    })

    expect(computePersistedFormPrefillPaths(normalizedPrefill)).toEqual([
      ['metadata', 'name'],
      ['metadata', 'namespace'],
      ['spec', 'ports', 0, 'name'],
      ['spec', 'ports', 0, 'port'],
      ['spec', 'ports', 0, 'protocol'],
      ['spec', 'ports', 0, 'targetPort'],
      ['spec', 'selector', 'app'],
      ['spec', 'type'],
    ])
  })

  it('preserves empty leaves from selected prefills during cleanup', () => {
    const input = {
      spec: {
        ports: [
          {
            name: '',
          },
        ],
      },
    }

    const normalizedPrefill = normalizeFormPrefill({
      spec: {
        customizationId: 'cid',
        values: [
          {
            path: ['spec'],
            value: input.spec,
          },
        ],
      },
    })

    const persistedPaths = computePersistedFormPrefillPaths(normalizedPrefill)

    expect(removeEmptyFormValues(input, persistedPaths)).toEqual(input)
  })
})
