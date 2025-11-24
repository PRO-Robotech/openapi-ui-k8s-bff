import { RequestHandler } from 'express'
import { getClusterSwaggerPaths } from 'src/cache'
import { checkIfApiInstanceNamespaceScoped, checkIfBuiltInInstanceNamespaceScoped } from 'src/utils/checkScope'
import {
  TCheckIfApiInstanceNamespaceScopedReq,
  TCheckIfApiInstanceNamespaceScopedRes,
  TCheckIfBuiltInInstanceNamespaceScopedReq,
  TCheckIfBuiltInInstanceNamespaceScopedRes,
} from 'src/localTypes/endpoints/scopes'

export const checkIfApiNamespaceScoped: RequestHandler = async (req: TCheckIfApiInstanceNamespaceScopedReq, res) => {
  try {
    const { cluster, ...rest } = req.body
    const swaggerPaths = await getClusterSwaggerPaths()
    if (!swaggerPaths) {
      return res.status(500).json('No swagger paths')
    }

    const result: TCheckIfApiInstanceNamespaceScopedRes = checkIfApiInstanceNamespaceScoped({ swaggerPaths, ...rest })
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
    return res.status(500).json(errorResponse)
  }
}

export const checkIfBuiltInNamespaceScoped: RequestHandler = async (
  req: TCheckIfBuiltInInstanceNamespaceScopedReq,
  res,
) => {
  try {
    const { cluster, ...rest } = req.body
    const swaggerPaths = await getClusterSwaggerPaths()
    if (!swaggerPaths) {
      return res.status(500).json('No swagger paths')
    }

    const result: TCheckIfBuiltInInstanceNamespaceScopedRes = checkIfBuiltInInstanceNamespaceScoped({
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
    return res.status(500).json(errorResponse)
  }
}
