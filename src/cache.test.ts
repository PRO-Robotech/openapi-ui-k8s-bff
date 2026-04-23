jest.mock('src/constants/httpAgent', () => ({
  kubeApi: { get: jest.fn() },
}))

jest.mock('@readme/openapi-parser', () => ({
  dereference: jest.fn(),
}))

import { dereference } from '@readme/openapi-parser'
import { kubeApi } from 'src/constants/httpAgent'
import {
  cache,
  getClusterSwagger,
  getOpenApiV3DiscoveryPath,
  getOpenApiV3Document,
  getOpenApiV3Index,
  getOpenApiV3ServerRelativeUrlFromIndex,
} from './cache'

const mockedDereference = jest.mocked(dereference)
const mockedGet = jest.mocked(kubeApi.get)

describe('cache openapi v3 helpers', () => {
  beforeEach(() => {
    cache.flushAll()
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('builds correct discovery path for builtin and api resources', () => {
    expect(
      getOpenApiV3DiscoveryPath({
        type: 'builtin',
        plural: 'pods',
      }),
    ).toBe('api/v1')

    expect(
      getOpenApiV3DiscoveryPath({
        type: 'apis',
        apiGroup: 'apps',
        apiVersion: 'v1',
        plural: 'deployments',
      }),
    ).toBe('apis/apps/v1')
  })

  it('resolves serverRelativeURL from discovery index', () => {
    expect(
      getOpenApiV3ServerRelativeUrlFromIndex({
        discoveryIndex: {
          paths: {
            'apis/apps/v1': {
              serverRelativeURL: '/openapi/v3/apis/apps/v1?hash=abc',
            },
          },
        },
        discoveryPath: 'apis/apps/v1',
      }),
    ).toBe('/openapi/v3/apis/apps/v1?hash=abc')
  })

  it('negative-caches unavailable v3 discovery index', async () => {
    mockedGet.mockRejectedValueOnce(new Error('connection refused'))

    await expect(getOpenApiV3Index()).resolves.toBeUndefined()
    await expect(getOpenApiV3Index()).resolves.toBeUndefined()

    expect(mockedGet).toHaveBeenCalledTimes(1)
    expect(mockedGet).toHaveBeenCalledWith('/openapi/v3')
  })

  it('negative-caches unavailable v2 swagger fetches', async () => {
    mockedGet.mockRejectedValueOnce(new Error('swagger unavailable'))

    await expect(getClusterSwagger()).resolves.toBeUndefined()
    await expect(getClusterSwagger()).resolves.toBeUndefined()

    expect(mockedGet).toHaveBeenCalledTimes(1)
    expect(mockedGet).toHaveBeenCalledWith('/openapi/v2')
    expect(mockedDereference).not.toHaveBeenCalled()
  })

  it('caches and dereferences v3 document by serverRelativeURL', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        openapi: '3.0.0',
        info: { title: 'demo', version: 'v1' },
        paths: {},
      },
    })
    mockedDereference.mockResolvedValueOnce({
      openapi: '3.0.0',
      info: { title: 'demo-derefed', version: 'v1' },
      paths: {},
    })

    const serverRelativeURL = '/openapi/v3/apis/apps/v1?hash=abc'

    await expect(getOpenApiV3Document(serverRelativeURL)).resolves.toEqual({
      openapi: '3.0.0',
      info: { title: 'demo-derefed', version: 'v1' },
      paths: {},
    })
    await expect(getOpenApiV3Document(serverRelativeURL)).resolves.toEqual({
      openapi: '3.0.0',
      info: { title: 'demo-derefed', version: 'v1' },
      paths: {},
    })

    expect(mockedGet).toHaveBeenCalledTimes(1)
    expect(mockedGet).toHaveBeenCalledWith(serverRelativeURL)
    expect(mockedDereference).toHaveBeenCalledTimes(1)
  })

  it('negative-caches failed v3 document fetches', async () => {
    const serverRelativeURL = '/openapi/v3/apis/apps/v1?hash=broken'

    mockedGet.mockRejectedValueOnce(new Error('timeout'))

    await expect(getOpenApiV3Document(serverRelativeURL)).resolves.toBeUndefined()
    await expect(getOpenApiV3Document(serverRelativeURL)).resolves.toBeUndefined()

    expect(mockedGet).toHaveBeenCalledTimes(1)
    expect(mockedGet).toHaveBeenCalledWith(serverRelativeURL)
    expect(mockedDereference).not.toHaveBeenCalled()
  })
})
