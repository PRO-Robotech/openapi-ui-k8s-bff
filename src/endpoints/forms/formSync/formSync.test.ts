import { getFormValuesByYaml, getYamlValuesByFromValues } from './formSync'
import { onValuesChange } from './utils/onValuesChange'
import { onYamlChange } from './utils/onYamlChange'

jest.mock('./utils/onValuesChange', () => ({
  onValuesChange: jest.fn(),
}))

jest.mock('./utils/onYamlChange', () => ({
  onYamlChange: jest.fn(),
}))

const mockedOnValuesChange = jest.mocked(onValuesChange)
const mockedOnYamlChange = jest.mocked(onYamlChange)

const createRes = () => {
  const res = {
    json: jest.fn(),
    status: jest.fn(),
  } as any
  res.status.mockReturnValue(res)
  return res
}

describe('formSync handlers', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    delete process.env.DEVELOPMENT
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('getYamlValuesByFromValues returns transformed values', async () => {
    mockedOnValuesChange.mockReturnValue({ spec: { replicas: 3 } })
    const req = {
      body: {
        values: { spec: { replicas: 3 } },
        persistedKeys: [],
        properties: {},
      },
    } as any
    const res = createRes()
    const next = jest.fn()

    await getYamlValuesByFromValues(req, res, next)

    expect(mockedOnValuesChange).toHaveBeenCalledWith(req.body)
    expect(res.json).toHaveBeenCalledWith({ spec: { replicas: 3 } })
    expect(res.status).not.toHaveBeenCalled()
  })

  it('getYamlValuesByFromValues returns 500 payload on transform error', async () => {
    mockedOnValuesChange.mockImplementation(() => {
      throw new Error('transform failed')
    })
    const req = {
      body: {
        values: {},
        persistedKeys: [],
        properties: {},
      },
    } as any
    const res = createRes()
    const next = jest.fn()

    await getYamlValuesByFromValues(req, res, next)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'transform failed' })
  })

  it('getFormValuesByYaml returns transformed form values', async () => {
    mockedOnYamlChange.mockReturnValue({ spec: { cpu: 0.5 } })
    const req = {
      body: {
        values: { spec: { cpu: '500m' } },
        properties: {},
      },
    } as any
    const res = createRes()
    const next = jest.fn()

    await getFormValuesByYaml(req, res, next)

    expect(mockedOnYamlChange).toHaveBeenCalledWith(req.body)
    expect(res.json).toHaveBeenCalledWith({ spec: { cpu: 0.5 } })
    expect(res.status).not.toHaveBeenCalled()
  })

  it('getFormValuesByYaml returns 500 payload on yaml transform error', async () => {
    mockedOnYamlChange.mockImplementation(() => {
      throw new Error('yaml transform failed')
    })
    const req = {
      body: {
        values: {},
        properties: {},
      },
    } as any
    const res = createRes()
    const next = jest.fn()

    await getFormValuesByYaml(req, res, next)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'yaml transform failed' })
  })
})
