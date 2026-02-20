import { drain } from './drain'
import { userKubeApi } from 'src/constants/httpAgent'
import type { Request, Response } from 'express'

jest.mock('src/constants/httpAgent', () => ({
  userKubeApi: { get: jest.fn(), patch: jest.fn(), post: jest.fn() },
}))

jest.mock('src/constants/envs', () => ({ DEVELOPMENT: true }))
jest.mock('src/utils/filterHeadersFromEnv', () => ({ filterHeadersFromEnv: () => ({}) }))

const mockedGet = userKubeApi.get as jest.Mock
const mockedPatch = userKubeApi.patch as jest.Mock
const mockedPost = userKubeApi.post as jest.Mock

function makeReq(body: Record<string, unknown> = {}) {
  return { body, headers: {} } as unknown as Request
}

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response
  return res
}

function makePod(name: string, namespace: string, opts: { phase?: string; mirror?: boolean; ownerKind?: string } = {}) {
  return {
    metadata: {
      name,
      namespace,
      ...(opts.mirror ? { annotations: { 'kubernetes.io/config.mirror': 'true' } } : {}),
      ...(opts.ownerKind ? { ownerReferences: [{ kind: opts.ownerKind }] } : {}),
    },
    ...(opts.phase ? { status: { phase: opts.phase } } : {}),
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

describe('drain', () => {
  it('returns 400 when nodeName is missing', async () => {
    const res = makeRes()
    await drain(makeReq({ apiPath: '/api/v1/nodes/node1' }), res, jest.fn())
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('required') }))
  })

  it('returns 400 when apiPath is missing', async () => {
    const res = makeRes()
    await drain(makeReq({ nodeName: 'node1' }), res, jest.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('cordons the node first', async () => {
    mockedPatch.mockResolvedValueOnce({ data: {} })
    mockedGet.mockResolvedValueOnce({ data: { items: [] } })

    const res = makeRes()
    await drain(makeReq({ nodeName: 'node1', apiPath: '/api/v1/nodes/node1' }), res, jest.fn())

    expect(mockedPatch).toHaveBeenCalledWith(
      '/api/v1/nodes/node1',
      { spec: { unschedulable: true } },
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/strategic-merge-patch+json' }),
      }),
    )
  })

  it('skips Succeeded and Failed pods', async () => {
    mockedPatch.mockResolvedValueOnce({ data: {} })
    mockedGet.mockResolvedValueOnce({
      data: {
        items: [
          makePod('pod-ok', 'default'),
          makePod('pod-succeeded', 'default', { phase: 'Succeeded' }),
          makePod('pod-failed', 'default', { phase: 'Failed' }),
        ],
      },
    })
    mockedPost.mockResolvedValue({ data: {} })

    const res = makeRes()
    await drain(makeReq({ nodeName: 'node1', apiPath: '/api/v1/nodes/node1' }), res, jest.fn())

    expect(mockedPost).toHaveBeenCalledTimes(1)
    expect(res.json).toHaveBeenCalledWith({ drained: 1, failed: [], skipped: 2 })
  })

  it('skips mirror pods', async () => {
    mockedPatch.mockResolvedValueOnce({ data: {} })
    mockedGet.mockResolvedValueOnce({
      data: {
        items: [makePod('pod-ok', 'default'), makePod('pod-mirror', 'default', { mirror: true })],
      },
    })
    mockedPost.mockResolvedValue({ data: {} })

    const res = makeRes()
    await drain(makeReq({ nodeName: 'node1', apiPath: '/api/v1/nodes/node1' }), res, jest.fn())

    expect(mockedPost).toHaveBeenCalledTimes(1)
    expect(res.json).toHaveBeenCalledWith({ drained: 1, failed: [], skipped: 1 })
  })

  it('skips DaemonSet pods when ignoreDaemonSets is true (default)', async () => {
    mockedPatch.mockResolvedValueOnce({ data: {} })
    mockedGet.mockResolvedValueOnce({
      data: {
        items: [makePod('pod-ok', 'default'), makePod('pod-ds', 'default', { ownerKind: 'DaemonSet' })],
      },
    })
    mockedPost.mockResolvedValue({ data: {} })

    const res = makeRes()
    await drain(makeReq({ nodeName: 'node1', apiPath: '/api/v1/nodes/node1' }), res, jest.fn())

    expect(mockedPost).toHaveBeenCalledTimes(1)
    expect(res.json).toHaveBeenCalledWith({ drained: 1, failed: [], skipped: 1 })
  })

  it('does NOT skip DaemonSet pods when ignoreDaemonSets is false', async () => {
    mockedPatch.mockResolvedValueOnce({ data: {} })
    mockedGet.mockResolvedValueOnce({
      data: {
        items: [makePod('pod-ok', 'default'), makePod('pod-ds', 'default', { ownerKind: 'DaemonSet' })],
      },
    })
    mockedPost.mockResolvedValue({ data: {} })

    const res = makeRes()
    await drain(makeReq({ nodeName: 'node1', apiPath: '/api/v1/nodes/node1', ignoreDaemonSets: false }), res, jest.fn())

    expect(mockedPost).toHaveBeenCalledTimes(2)
    expect(res.json).toHaveBeenCalledWith({ drained: 2, failed: [], skipped: 0 })
  })

  it('includes gracePeriodSeconds in eviction body when provided', async () => {
    mockedPatch.mockResolvedValueOnce({ data: {} })
    mockedGet.mockResolvedValueOnce({ data: { items: [makePod('pod1', 'ns1')] } })
    mockedPost.mockResolvedValue({ data: {} })

    const res = makeRes()
    await drain(makeReq({ nodeName: 'node1', apiPath: '/api/v1/nodes/node1', gracePeriodSeconds: 30 }), res, jest.fn())

    const evictionBody = mockedPost.mock.calls[0][1]
    expect(evictionBody.deleteOptions).toEqual({ gracePeriodSeconds: 30 })
  })

  it('does NOT include deleteOptions when gracePeriodSeconds is not provided', async () => {
    mockedPatch.mockResolvedValueOnce({ data: {} })
    mockedGet.mockResolvedValueOnce({ data: { items: [makePod('pod1', 'ns1')] } })
    mockedPost.mockResolvedValue({ data: {} })

    const res = makeRes()
    await drain(makeReq({ nodeName: 'node1', apiPath: '/api/v1/nodes/node1' }), res, jest.fn())

    const evictionBody = mockedPost.mock.calls[0][1]
    expect(evictionBody.deleteOptions).toBeUndefined()
  })

  it('sends correct eviction request per pod', async () => {
    mockedPatch.mockResolvedValueOnce({ data: {} })
    mockedGet.mockResolvedValueOnce({
      data: { items: [makePod('pod1', 'ns1'), makePod('pod2', 'ns2')] },
    })
    mockedPost.mockResolvedValue({ data: {} })

    const res = makeRes()
    await drain(makeReq({ nodeName: 'node1', apiPath: '/api/v1/nodes/node1' }), res, jest.fn())

    expect(mockedPost).toHaveBeenCalledWith(
      '/api/v1/namespaces/ns1/pods/pod1/eviction',
      expect.objectContaining({
        apiVersion: 'policy/v1',
        kind: 'Eviction',
        metadata: { name: 'pod1', namespace: 'ns1' },
      }),
      expect.any(Object),
    )
    expect(mockedPost).toHaveBeenCalledWith(
      '/api/v1/namespaces/ns2/pods/pod2/eviction',
      expect.objectContaining({ metadata: { name: 'pod2', namespace: 'ns2' } }),
      expect.any(Object),
    )
  })

  it('reports partial failures correctly', async () => {
    mockedPatch.mockResolvedValueOnce({ data: {} })
    mockedGet.mockResolvedValueOnce({
      data: { items: [makePod('pod-ok', 'ns1'), makePod('pod-fail', 'ns1')] },
    })
    mockedPost.mockResolvedValueOnce({ data: {} }).mockRejectedValueOnce(new Error('forbidden'))

    const res = makeRes()
    await drain(makeReq({ nodeName: 'node1', apiPath: '/api/v1/nodes/node1' }), res, jest.fn())

    expect(res.json).toHaveBeenCalledWith({
      drained: 1,
      failed: [{ name: 'pod-fail', namespace: 'ns1', error: 'forbidden' }],
      skipped: 0,
    })
  })

  it('returns 500 when cordon patch fails', async () => {
    mockedPatch.mockRejectedValueOnce(new Error('unauthorized'))

    const res = makeRes()
    await drain(makeReq({ nodeName: 'node1', apiPath: '/api/v1/nodes/node1' }), res, jest.fn())

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'unauthorized' }))
  })

  it('handles empty pod list', async () => {
    mockedPatch.mockResolvedValueOnce({ data: {} })
    mockedGet.mockResolvedValueOnce({ data: { items: [] } })

    const res = makeRes()
    await drain(makeReq({ nodeName: 'node1', apiPath: '/api/v1/nodes/node1' }), res, jest.fn())

    expect(mockedPost).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({ drained: 0, failed: [], skipped: 0 })
  })
})
