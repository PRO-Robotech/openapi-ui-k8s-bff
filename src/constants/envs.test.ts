describe('parseJsonEnvStringArray', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('returns parsed string arrays', async () => {
    const { parseJsonEnvStringArray } = await import('src/utils/parseJsonEnvStringArray')

    expect(parseJsonEnvStringArray('["error.message","headers.authorization"]', 'TEST_ENV')).toEqual([
      'error.message',
      'headers.authorization',
    ])
  })

  test('warns and returns empty array for malformed JSON', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const { parseJsonEnvStringArray } = await import('src/utils/parseJsonEnvStringArray')

    expect(parseJsonEnvStringArray('{"error":"message"}', 'TEST_ENV')).toEqual([])
    expect(parseJsonEnvStringArray('[oops', 'TEST_ENV')).toEqual([])
    expect(warnSpy).toHaveBeenCalled()
  })
})
