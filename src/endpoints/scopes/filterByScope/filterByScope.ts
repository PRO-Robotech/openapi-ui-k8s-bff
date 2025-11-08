import { RequestHandler } from 'express'
import { getClusterSwaggerPaths } from 'src/cache'
import {
  TFilterIfApiInstanceNamespaceScopedReq,
  TFilterIfApiInstanceNamespaceScopedRes,
  TFilterIfBuiltInInstanceNamespaceScopedReq,
  TFilterIfBuiltInInstanceNamespaceScopedRes,
} from 'src/localTypes/endpoints/scopes'
import { filterBuiltinResources } from './utils/filterBuiltinResources'
import { filterApiResources } from './utils/filterApiResources'

export const filterIfApiNamespaceScoped: RequestHandler = async (req: TFilterIfApiInstanceNamespaceScopedReq, res) => {
  try {
    const { clusterName, ...rest } = req.body
    const swaggerPaths = await getClusterSwaggerPaths()
    if (!swaggerPaths) {
      return res.status(500).json('No swagger')
    }

    const result: TFilterIfApiInstanceNamespaceScopedRes = filterApiResources({ swaggerPaths, ...rest })
    return res.json(result)
  } catch (error) {
    console.error('Error getting dereferenced Swagger:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error: error,
      body: req.body,
    })

    const errorResponse = {
      error: error instanceof Error ? error.message : String(error),
      ...(process.env.DEVELOPMENT === 'TRUE' && error instanceof Error ? { stack: error.stack } : {}),
    }
    res.status(500).json(errorResponse)
  }
}

export const filterIfBuiltInNamespaceScoped: RequestHandler = async (
  req: TFilterIfBuiltInInstanceNamespaceScopedReq,
  res,
) => {
  try {
    const { clusterName, ...rest } = req.body
    const swaggerPaths = await getClusterSwaggerPaths()
    if (!swaggerPaths) {
      return res.status(500).json('No swagger')
    }

    const result: TFilterIfBuiltInInstanceNamespaceScopedRes = filterBuiltinResources({
      swaggerPaths,
      ...rest,
    })
    return res.json(result)
  } catch (error) {
    console.error('Error getting dereferenced Swagger:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error: error,
      body: req.body,
    })

    const errorResponse = {
      error: error instanceof Error ? error.message : String(error),
      ...(process.env.DEVELOPMENT === 'TRUE' && error instanceof Error ? { stack: error.stack } : {}),
    }
    res.status(500).json(errorResponse)
  }
}
