import { prepare } from './prepare'
import { finalizePreparedForm, resolvePrepareSchemaSource } from './utils'

jest.mock('./utils', () => ({
  finalizePreparedForm: jest.fn(),
  resolvePrepareSchemaSource: jest.fn(),
}))

const mockedFinalizePreparedForm = jest.mocked(finalizePreparedForm)
const mockedResolvePrepareSchemaSource = jest.mocked(resolvePrepareSchemaSource)

const baseArgs = {
  data: {
    type: 'builtin' as const,
    plural: 'pods',
  },
  cluster: 'demo',
}

describe('prepare', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('delegates successful source extraction to shared finalize logic', async () => {
    mockedResolvePrepareSchemaSource.mockResolvedValue({
      source: 'v2',
      status: 'success',
      bodyParametersSchema: { type: 'object', properties: {} },
      isNamespaced: true,
      kind: 'Pod',
    })
    mockedFinalizePreparedForm.mockReturnValue({
      result: 'success',
      properties: {},
      required: [],
      hiddenPaths: [],
      expandedPaths: [],
      persistedPaths: [],
      sortPaths: [],
      kind: 'Pod',
      isNamespaced: true,
      forceViewMode: 'OpenAPI',
      formPrefills: undefined,
      namespacesData: [],
    })

    const result = await prepare(baseArgs)

    expect(mockedFinalizePreparedForm).toHaveBeenCalledWith({
      data: baseArgs.data,
      formsOverridesData: undefined,
      formsPrefillsData: undefined,
      customizationId: undefined,
      customizationIdPrefill: undefined,
      partsOfUrl: undefined,
      namespacesData: undefined,
      source: 'v2',
      status: 'success',
      bodyParametersSchema: { type: 'object', properties: {} },
      isNamespaced: true,
      kind: 'Pod',
    })
    expect(result).toEqual({
      result: 'success',
      properties: {},
      required: [],
      hiddenPaths: [],
      expandedPaths: [],
      persistedPaths: [],
      sortPaths: [],
      kind: 'Pod',
      isNamespaced: true,
      forceViewMode: 'OpenAPI',
      formPrefills: undefined,
      namespacesData: [],
    })
  })

  it('returns manual-mode fallback for unsupported v3 schema without calling shared finalize logic', async () => {
    mockedResolvePrepareSchemaSource.mockResolvedValue({
      source: 'v3',
      status: 'unsupported',
      error: 'Unsupported OpenAPI v3 schema for auto-generated form',
      issues: [{ keyword: 'oneOf', path: ['spec'] }],
      isNamespaced: false,
      kind: 'Widget',
    })

    const result = await prepare(baseArgs)

    expect(mockedFinalizePreparedForm).not.toHaveBeenCalled()
    expect(result).toEqual({
      result: 'error',
      error: 'Unsupported OpenAPI v3 schema for auto-generated form',
      isNamespaced: false,
      kind: 'Widget',
      fallbackToManualMode: true,
    })
  })

  it('returns manual-mode fallback when both sources fail to produce a usable schema', async () => {
    mockedResolvePrepareSchemaSource.mockResolvedValue({
      source: 'v2',
      status: 'unavailable',
      error: 'no swagger paths',
    })

    const result = await prepare(baseArgs)

    expect(mockedFinalizePreparedForm).not.toHaveBeenCalled()
    expect(result).toEqual({
      result: 'error',
      error: 'no swagger paths',
      isNamespaced: false,
      kind: undefined,
      fallbackToManualMode: true,
    })
  })
})
