import { rollback } from './rollback'
import { userKubeApi } from 'src/constants/httpAgent'
import type { Request, Response } from 'express'

jest.mock('src/constants/httpAgent', () => ({
  userKubeApi: { get: jest.fn(), patch: jest.fn() },
}))

jest.mock('src/constants/envs', () => ({ DEVELOPMENT: true }))
jest.mock('src/utils/filterHeadersFromEnv', () => ({ filterHeadersFromEnv: () => ({}) }))

const mockedGet = userKubeApi.get as jest.Mock
const mockedPatch = userKubeApi.patch as jest.Mock

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

function makeDeployment(revision: number, uid = 'deploy-uid-1') {
  return {
    apiVersion: 'apps/v1',
    metadata: {
      name: 'my-deploy',
      namespace: 'default',
      uid,
      annotations: { 'deployment.kubernetes.io/revision': String(revision) },
    },
    spec: {
      selector: { matchLabels: { app: 'my-deploy' } as Record<string, string> },
    },
  }
}

function makeRS(name: string, revision: number, ownerUid: string, template: Record<string, unknown> = {}) {
  return {
    metadata: {
      name,
      annotations: { 'deployment.kubernetes.io/revision': String(revision) },
      ownerReferences: [{ uid: ownerUid, kind: 'Deployment', name: 'my-deploy' }],
    },
    spec: { template },
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

describe('rollback', () => {
  it('returns 400 when resourceEndpoint is missing', async () => {
    const res = makeRes()
    await rollback(makeReq({ resourceName: 'x' }), res, jest.fn())
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('required') }))
  })

  it('returns 400 when resourceName is missing', async () => {
    const res = makeRes()
    await rollback(makeReq({ resourceEndpoint: '/apis/apps/v1/namespaces/default/deployments/x' }), res, jest.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 400 when current revision is 1', async () => {
    mockedGet.mockResolvedValueOnce({ data: makeDeployment(1) })
    const res = makeRes()
    await rollback(
      makeReq({ resourceEndpoint: '/apis/apps/v1/namespaces/default/deployments/x', resourceName: 'x' }),
      res,
      jest.fn(),
    )
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('No previous revision') }),
    )
  })

  it('returns 400 when deployment has no matchLabels', async () => {
    const deploy = makeDeployment(3)
    deploy.spec.selector.matchLabels = {} as Record<string, string>
    mockedGet.mockResolvedValueOnce({ data: deploy })
    const res = makeRes()
    await rollback(
      makeReq({ resourceEndpoint: '/apis/apps/v1/namespaces/default/deployments/x', resourceName: 'x' }),
      res,
      jest.fn(),
    )
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('matchLabels') }))
  })

  it('filters out ReplicaSets not owned by this Deployment', async () => {
    const deploy = makeDeployment(3)
    const ownedRS = makeRS('rs-owned', 2, 'deploy-uid-1', { spec: { containers: [{ image: 'nginx:1.24' }] } })
    const foreignRS = makeRS('rs-foreign', 2, 'other-deploy-uid', { spec: { containers: [{ image: 'nginx:1.20' }] } })

    mockedGet.mockResolvedValueOnce({ data: deploy }).mockResolvedValueOnce({ data: { items: [ownedRS, foreignRS] } })
    mockedPatch.mockResolvedValueOnce({ data: {} })

    const res = makeRes()
    await rollback(
      makeReq({ resourceEndpoint: '/apis/apps/v1/namespaces/default/deployments/x', resourceName: 'x' }),
      res,
      jest.fn(),
    )

    // Should have patched with the owned RS's template, not the foreign one
    const patchBody = mockedPatch.mock.calls[0][1]
    expect(patchBody[0].value).toEqual(ownedRS.spec.template)
  })

  it('handles non-contiguous revisions (picks highest below current)', async () => {
    const deploy = makeDeployment(5)
    const rs1 = makeRS('rs-1', 1, 'deploy-uid-1', { v: 1 })
    const rs3 = makeRS('rs-3', 3, 'deploy-uid-1', { v: 3 })
    // Revision 4 is missing (garbage-collected)

    mockedGet.mockResolvedValueOnce({ data: deploy }).mockResolvedValueOnce({ data: { items: [rs1, rs3] } })
    mockedPatch.mockResolvedValueOnce({ data: {} })

    const res = makeRes()
    await rollback(
      makeReq({ resourceEndpoint: '/apis/apps/v1/namespaces/default/deployments/x', resourceName: 'x' }),
      res,
      jest.fn(),
    )

    // Should pick revision 3, not try revision 4
    expect(res.json).toHaveBeenCalledWith({ rolledBack: true, fromRevision: 5, toRevision: 3 })
    expect(mockedPatch.mock.calls[0][1][0].value).toEqual({ v: 3 })
  })

  it('returns 400 when no previous RS revision exists', async () => {
    const deploy = makeDeployment(3)
    // Only RS with current revision, nothing lower
    const currentRS = makeRS('rs-current', 3, 'deploy-uid-1', {})

    mockedGet.mockResolvedValueOnce({ data: deploy }).mockResolvedValueOnce({ data: { items: [currentRS] } })

    const res = makeRes()
    await rollback(
      makeReq({ resourceEndpoint: '/apis/apps/v1/namespaces/default/deployments/x', resourceName: 'x' }),
      res,
      jest.fn(),
    )

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('No previous') }))
  })

  it('sends JSON Patch with two replace operations (matches kubectl)', async () => {
    const deploy = makeDeployment(3)
    const prevRS = makeRS('rs-prev', 2, 'deploy-uid-1', {
      metadata: { labels: { app: 'my-deploy' } },
      spec: { containers: [{ name: 'nginx', image: 'nginx:1.24' }] },
    })

    mockedGet.mockResolvedValueOnce({ data: deploy }).mockResolvedValueOnce({ data: { items: [prevRS] } })
    mockedPatch.mockResolvedValueOnce({ data: {} })

    const res = makeRes()
    await rollback(
      makeReq({ resourceEndpoint: '/apis/apps/v1/namespaces/default/deployments/x', resourceName: 'x' }),
      res,
      jest.fn(),
    )

    // Verify JSON Patch format
    const [url, body, config] = mockedPatch.mock.calls[0]
    expect(url).toBe('/apis/apps/v1/namespaces/default/deployments/x')
    expect(config.headers['Content-Type']).toBe('application/json-patch+json')
    expect(body).toHaveLength(2)
    expect(body[0]).toEqual({ op: 'replace', path: '/spec/template', value: prevRS.spec.template })
    expect(body[1]).toEqual({ op: 'replace', path: '/metadata/annotations', value: deploy.metadata.annotations })
  })

  it('returns correct response on success', async () => {
    const deploy = makeDeployment(4)
    const prevRS = makeRS('rs-prev', 3, 'deploy-uid-1', { spec: {} })

    mockedGet.mockResolvedValueOnce({ data: deploy }).mockResolvedValueOnce({ data: { items: [prevRS] } })
    mockedPatch.mockResolvedValueOnce({ data: {} })

    const res = makeRes()
    await rollback(
      makeReq({ resourceEndpoint: '/apis/apps/v1/namespaces/default/deployments/x', resourceName: 'x' }),
      res,
      jest.fn(),
    )

    expect(res.json).toHaveBeenCalledWith({ rolledBack: true, fromRevision: 4, toRevision: 3 })
  })

  it('returns 500 when K8s API throws', async () => {
    mockedGet.mockRejectedValueOnce(new Error('connection refused'))

    const res = makeRes()
    await rollback(
      makeReq({ resourceEndpoint: '/apis/apps/v1/namespaces/default/deployments/x', resourceName: 'x' }),
      res,
      jest.fn(),
    )

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'connection refused' }))
  })
})
