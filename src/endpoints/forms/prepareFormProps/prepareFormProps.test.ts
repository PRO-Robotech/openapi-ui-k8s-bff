import { prepareFormProps } from './prepareFormProps'
import { userKubeApi } from 'src/constants/httpAgent'
import { prepare } from './utils'

jest.mock('src/constants/httpAgent', () => ({
  userKubeApi: {
    get: jest.fn(),
  },
}))

jest.mock('./utils', () => ({
  prepare: jest.fn(),
}))

const mockedUserKubeApiGet = jest.mocked(userKubeApi.get)
const mockedPrepare = jest.mocked(prepare)

const createRes = () => {
  const res = {
    json: jest.fn(),
    status: jest.fn(),
  } as any
  res.status.mockReturnValue(res)
  return res
}

describe('prepareFormProps handler', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    delete process.env.DEVELOPMENT
  })

  it('loads cluster form resources and returns prepared form payload', async () => {
    mockedUserKubeApiGet
      .mockResolvedValueOnce({ data: { items: [{ spec: { customizationId: 'ovr' } }] } } as any)
      .mockResolvedValueOnce({ data: { items: [{ spec: { customizationId: 'prefill' } }] } } as any)
      .mockResolvedValueOnce({ data: { items: [{ metadata: { name: 'incloud-web' } }] } } as any)

    mockedPrepare.mockResolvedValue({
      result: 'success',
      properties: {
        spec: {
          type: 'object',
          properties: {
            replicas: { type: 'integer', default: 3 },
          },
        },
      },
      required: ['spec'],
      hiddenPaths: [],
      expandedPaths: [],
      persistedPaths: [],
      sortPaths: [],
      kind: 'DemoApp',
      isNamespaced: true,
      formPrefills: undefined,
      namespacesData: ['incloud-web'],
    })

    const req = {
      body: {
        cluster: 'default',
        partsOfUrl: ['openapi-ui', 'default', 'incloud-web', 'forms', 'apis', 'incloud.prorobotech.com', 'v1', 'demoapps'],
        customizationId: 'default-/incloud.prorobotech.com/v1/demoapps',
        customizationIdPrefill: 'default-/incloud.prorobotech.com/v1/demoapps',
        data: {
          type: 'apis',
          apiGroup: 'incloud.prorobotech.com',
          apiVersion: 'v1',
          plural: 'demoapps',
          prefillValueNamespaceOnly: 'incloud-web',
        },
      },
      headers: {},
    } as any
    const res = createRes()
    const next = jest.fn()

    await prepareFormProps(req, res, next)

    expect(mockedPrepare).toHaveBeenCalledWith({
      ...req.body,
      formsOverridesData: { items: [{ spec: { customizationId: 'ovr' } }] },
      formsPrefillsData: { items: [{ spec: { customizationId: 'prefill' } }] },
      namespacesData: { items: [{ metadata: { name: 'incloud-web' } }] },
    })
    expect(res.json).toHaveBeenCalledWith({
      result: 'success',
      properties: {
        spec: {
          type: 'object',
          properties: {
            replicas: { type: 'integer', default: 3 },
          },
        },
      },
      required: ['spec'],
      hiddenPaths: [],
      expandedPaths: [],
      persistedPaths: [],
      sortPaths: [],
      kind: 'DemoApp',
      isNamespaced: true,
      formPrefills: undefined,
      namespacesData: ['incloud-web'],
    })
  })

  it('returns 500 payload when prepare pipeline throws', async () => {
    mockedUserKubeApiGet
      .mockResolvedValueOnce({ data: { items: [] } } as any)
      .mockResolvedValueOnce({ data: { items: [] } } as any)
      .mockResolvedValueOnce({ data: { items: [] } } as any)
    mockedPrepare.mockRejectedValue(new Error('prepare failed'))

    const req = {
      body: {
        cluster: 'default',
        partsOfUrl: ['openapi-ui', 'default'],
        data: {
          type: 'builtin',
          plural: 'pods',
        },
      },
      headers: {},
    } as any
    const res = createRes()
    const next = jest.fn()

    await prepareFormProps(req, res, next)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'prepare failed' })
  })
})
