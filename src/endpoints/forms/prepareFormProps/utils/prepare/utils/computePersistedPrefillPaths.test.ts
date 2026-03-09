import { removeEmptyFormValues } from 'src/endpoints/forms/formSync/utils/removeAndRename'
import { computePersistedPrefillPaths } from './computePersistedPrefillPaths'

describe('computePersistedPrefillPaths', () => {
  it('collects array item paths from prefillValuesSchema', () => {
    const persistedPaths = computePersistedPrefillPaths({
      prefillValuesSchema: {
        spec: {
          tags: ['one'],
          tolerations: [{ key: '' }],
        },
      },
    })

    expect(persistedPaths).toEqual([
      ['spec'],
      ['spec', 'tags'],
      ['spec', 'tags', 0],
      ['spec', 'tolerations'],
      ['spec', 'tolerations', 0],
      ['spec', 'tolerations', 0, 'key'],
    ])
  })

  it('preserves prefilled empty fields inside arrays during cleanup', () => {
    const input = {
      spec: {
        tolerations: [{ key: '' }],
      },
    }

    const persistedPaths = computePersistedPrefillPaths({
      prefillValuesSchema: input,
    })

    expect(removeEmptyFormValues(input, persistedPaths)).toEqual(input)
  })
})
