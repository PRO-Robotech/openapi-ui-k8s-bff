import { RequestHandler } from 'express'
import { getClusterSwagger } from 'src/cache'

export const getDerefedSwagger: RequestHandler = async (req, res) => {
  try {
    const swagger = await getClusterSwagger()

    return res.json(swagger)
  } catch (error) {
    console.error('Error getting dereferenced Swagger:', error)
    return res.status(500).json(error)
  }
}
