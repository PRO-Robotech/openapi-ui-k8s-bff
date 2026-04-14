import NodeCache from 'node-cache'
import { kubeApi } from 'src/constants/httpAgent'
import { cache, getV3SchemaForGroup } from './cache'

jest.mock('src/constants/httpAgent', () => ({
  kubeApi: { get: jest.fn() },
}))

const mockKubeGet = kubeApi.get as jest.Mock

describe('getV3SchemaForGroup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // flush all cached keys between tests
    cache.flushAll()
  })

  it('fetches and caches v3 spec on first call', async () => {
    const fakeSpec = { components: { schemas: {} } }
    mockKubeGet.mockResolvedValueOnce({ data: fakeSpec })

    const result = await getV3SchemaForGroup('apis', 'incloud.prorobotech.com', 'v1')

    expect(result).toEqual(fakeSpec)
    expect(mockKubeGet).toHaveBeenCalledTimes(1)
    expect(mockKubeGet).toHaveBeenCalledWith(
      '/openapi/v3/apis/incloud.prorobotech.com/v1',
      expect.objectContaining({ timeout: 10_000 }),
    )
  })

  it('returns cached spec on second call without hitting network', async () => {
    const fakeSpec = { components: { schemas: {} } }
    mockKubeGet.mockResolvedValueOnce({ data: fakeSpec })

    await getV3SchemaForGroup('apis', 'incloud.prorobotech.com', 'v1')
    const result = await getV3SchemaForGroup('apis', 'incloud.prorobotech.com', 'v1')

    expect(result).toEqual(fakeSpec)
    expect(mockKubeGet).toHaveBeenCalledTimes(1)
  })

  it('uses /openapi/v3/api/v1 path for builtin type', async () => {
    const fakeSpec = { components: { schemas: {} } }
    mockKubeGet.mockResolvedValueOnce({ data: fakeSpec })

    await getV3SchemaForGroup('builtin')

    expect(mockKubeGet).toHaveBeenCalledWith(
      '/openapi/v3/api/v1',
      expect.anything(),
    )
  })

  it('returns undefined on network error (graceful degradation)', async () => {
    mockKubeGet.mockRejectedValueOnce(new Error('connect ECONNREFUSED'))

    const result = await getV3SchemaForGroup('apis', 'example.com', 'v1')

    expect(result).toBeUndefined()
  })

  it('caches negative result — does not retry after error', async () => {
    mockKubeGet.mockRejectedValueOnce(new Error('connect ECONNREFUSED'))

    const first = await getV3SchemaForGroup('apis', 'example.com', 'v1')
    const second = await getV3SchemaForGroup('apis', 'example.com', 'v1')

    expect(first).toBeUndefined()
    expect(second).toBeUndefined()
    expect(mockKubeGet).toHaveBeenCalledTimes(1)
  })

  it('retries after negative cache expires', async () => {
    mockKubeGet.mockRejectedValueOnce(new Error('connect ECONNREFUSED'))

    await getV3SchemaForGroup('apis', 'example.com', 'v1')
    expect(mockKubeGet).toHaveBeenCalledTimes(1)

    // simulate cache expiry by deleting the key
    const cacheKey = 'v3:/openapi/v3/apis/example.com/v1'
    cache.del(cacheKey)

    const fakeSpec = { components: { schemas: {} } }
    mockKubeGet.mockResolvedValueOnce({ data: fakeSpec })

    const result = await getV3SchemaForGroup('apis', 'example.com', 'v1')
    expect(result).toEqual(fakeSpec)
    expect(mockKubeGet).toHaveBeenCalledTimes(2)
  })

  it('different groups use separate cache keys', async () => {
    const specA = { components: { schemas: { a: {} } } }
    const specB = { components: { schemas: { b: {} } } }
    mockKubeGet.mockResolvedValueOnce({ data: specA })
    mockKubeGet.mockResolvedValueOnce({ data: specB })

    const a = await getV3SchemaForGroup('apis', 'group-a.io', 'v1')
    const b = await getV3SchemaForGroup('apis', 'group-b.io', 'v1')

    expect(a).toEqual(specA)
    expect(b).toEqual(specB)
    expect(mockKubeGet).toHaveBeenCalledTimes(2)
  })
})
