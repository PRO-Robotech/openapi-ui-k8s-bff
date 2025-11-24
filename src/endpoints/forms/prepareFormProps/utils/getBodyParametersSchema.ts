import _ from 'lodash'
import { OpenAPIV2 } from 'openapi-types'

export const getBodyParametersSchema = ({
  swaggerPathValue,
  swaggerPath,
}: {
  swaggerPathValue?: OpenAPIV2.PathItemObject
  swaggerPath: string
}): {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bodyParametersSchema: any
  kind?: string
  error?: string
} => {
  const postData = swaggerPathValue?.post

  if (!postData) {
    const error = `No post data for ${swaggerPath}`
    return { bodyParametersSchema: undefined, kind: undefined, error }
  }

  const xK8sGroupVersionKind = (postData as { 'x-kubernetes-group-version-kind'?: { kind: string } })?.[
    'x-kubernetes-group-version-kind'
  ]

  if (!xK8sGroupVersionKind) {
    const error = `postData with no x-kubernetes-group-version-kind: ${JSON.stringify(postData, null, 2)}`
    return { bodyParametersSchema: undefined, kind: undefined, error }
  }

  const kind = xK8sGroupVersionKind?.kind

  if (!kind) {
    const error = `x-kubernetes-group-version-kind with no kind: ${JSON.stringify(xK8sGroupVersionKind, null, 2)}`
    return { bodyParametersSchema: undefined, kind: undefined, error }
  }

  const parameters = postData?.parameters as OpenAPIV2.Parameter[] | undefined // ensure cause we call openapi v2

  if (!parameters) {
    const error = `postData with no parameters: ${JSON.stringify(postData, null, 2)}`
    return { bodyParametersSchema: undefined, kind, error }
  }

  const bodyParameters = parameters?.filter(el => el.in === 'body')[0]

  if (!bodyParameters) {
    const error = `paremeters with no ${'{in: body}'}: ${JSON.stringify(parameters, null, 2)}`
    return { bodyParametersSchema: undefined, kind, error }
  }

  const bodyParametersSchema = bodyParameters.schema

  if (!bodyParametersSchema) {
    const error = `bodyParameters with no schema:${JSON.stringify(bodyParameters, null, 2)}`
    return { bodyParametersSchema: undefined, kind, error }
  }

  if (Object.keys(bodyParametersSchema).includes('$ref')) {
    const error = 'Underefed schema'
    return { bodyParametersSchema, kind, error }
  }

  return { bodyParametersSchema, kind, error: undefined }
}
