import { resolvePrefillCustomizationId } from './resolvePrefillCustomizationId'

describe('resolvePrefillCustomizationId', () => {
  it('uses customizationIdPrefill when provided', () => {
    expect(
      resolvePrefillCustomizationId({
        customizationId: 'override-id',
        customizationIdPrefill: 'prefill-id',
      }),
    ).toBe('prefill-id')
  })

  it('falls back to customizationId when customizationIdPrefill is missing', () => {
    expect(
      resolvePrefillCustomizationId({
        customizationId: 'override-id',
      }),
    ).toBe('override-id')
  })

  it('returns undefined when both ids are missing', () => {
    expect(resolvePrefillCustomizationId({})).toBeUndefined()
  })
})
