import { RequestHandler } from 'express'
import _ from 'lodash'
import { TPrepareFormReq, TPrepareFormRes } from 'src/localTypes/endpoints/forms'
import { TFormsOverridesData, TFormsPrefillsData } from 'src/localTypes/formExtensions'
import { TBuiltinResources } from 'src/localTypes/k8s'
import { DEVELOPMENT, BASE_API_GROUP, BASE_API_VERSION } from 'src/constants/envs'
import { userKubeApi } from 'src/constants/httpAgent'
import { prepare } from './utils/prepare'
// import { getTokenFromCookie } from 'src/utils/getTokenFromCookie'

export const prepareFormProps: RequestHandler = async (req: TPrepareFormReq, res) => {
  try {
    // const bearerToken = getTokenFromCookie(req)
    // const cookies = req.headers.cookie

    const filteredHeaders = { ...req.headers }
    delete filteredHeaders['host'] // Avoid passing internal host header

    const { data: formsOverridesData } = await userKubeApi.get<TFormsOverridesData>(
      `/apis/${BASE_API_GROUP}/${BASE_API_VERSION}/customformsoverrides`,
      {
        headers: {
          // Authorization: `Bearer ${bearerToken}`,
          // Cookie: cookies,
          ...(DEVELOPMENT ? {} : filteredHeaders),
          'Content-Type': 'application/json',
        },
      },
    )

    const { data: formsPrefillsData } = await userKubeApi.get<TFormsPrefillsData>(
      `/apis/${BASE_API_GROUP}/${BASE_API_VERSION}/customformsprefills`,
      {
        headers: {
          // Authorization: `Bearer ${bearerToken}`,
          // Cookie: cookies,
          ...(DEVELOPMENT ? {} : filteredHeaders),
          'Content-Type': 'application/json',
        },
      },
    )

    const { data: namespacesData } = await userKubeApi.get<TBuiltinResources>(`/api/v1/namespaces`, {
      headers: {
        // Authorization: `Bearer ${bearerToken}`,
        // Cookie: cookies,
        ...(DEVELOPMENT ? {} : filteredHeaders),
        'Content-Type': 'application/json',
      },
    })

    const result: TPrepareFormRes = await prepare({
      ...req.body,
      formsOverridesData,
      formsPrefillsData,
      namespacesData,
    })
    res.json(result)
  } catch (error) {
    res.status(500).json(error)
  }
}
