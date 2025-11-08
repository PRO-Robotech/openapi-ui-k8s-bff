import { RequestHandler } from 'express'
import { getClusterSwagger } from 'src/cache'

export const getDerefedSwagger: RequestHandler = async (req, res) => {
  try {
    const swagger = await getClusterSwagger()

    return res.json(swagger)
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
