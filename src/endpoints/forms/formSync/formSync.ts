import { RequestHandler } from 'express'
import { TYamlByValuesReq, TValuesByYamlReq, TYamlByValuesRes, TValuesByYamlRes } from 'src/localTypes/endpoints/forms'
import { onValuesChange } from './utils/onValuesChange'
import { onYamlChange } from './utils/onYamlChange'

export const getYamlValuesByFromValues: RequestHandler = async (req: TYamlByValuesReq, res) => {
  try {
    const result: TYamlByValuesRes = onValuesChange(req.body)
    res.json(result)
  } catch (error) {
    console.error('[getYamlValuesByFromValues] Error:', {
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

export const getFormValuesByYaml: RequestHandler = async (req: TValuesByYamlReq, res) => {
  try {
    const result: TValuesByYamlRes = onYamlChange(req.body)
    res.json(result)
  } catch (error) {
    console.error('[getFormValuesByYaml] Error:', {
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
