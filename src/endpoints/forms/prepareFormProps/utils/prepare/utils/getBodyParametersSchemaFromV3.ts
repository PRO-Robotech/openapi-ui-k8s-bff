import { OpenAPIV3 } from 'openapi-types'
import { TFormSchemaNode } from 'src/localTypes/formSchema'

type TV3KindExtensionEntry = {
  kind?: string
  Kind?: string
}

const PREFERRED_MEDIA_TYPES = ['application/json']

const isReferenceObject = (value: unknown): value is OpenAPIV3.ReferenceObject =>
  value !== null && typeof value === 'object' && '$ref' in value

const getKindFromExtension = (value: unknown): string | undefined => {
  if (Array.isArray(value)) {
    return value.map(getKindFromExtension).find(Boolean)
  }

  if (!value || typeof value !== 'object') return undefined

  const typed = value as TV3KindExtensionEntry
  return typed.kind || typed.Kind
}

const getKindFromSchema = (schema: TFormSchemaNode): string | undefined => {
  const kindProperty = schema.properties?.kind

  if (!kindProperty) return undefined

  if (typeof kindProperty.default === 'string' && kindProperty.default.length > 0) {
    return kindProperty.default
  }

  if (Array.isArray(kindProperty.enum) && kindProperty.enum.length > 0) {
    const firstKind = kindProperty.enum.find((value): value is string => typeof value === 'string' && value.length > 0)
    return firstKind
  }

  return undefined
}

const getMediaTypeSchema = ({
  requestBody,
  swaggerPath,
}: {
  requestBody: OpenAPIV3.RequestBodyObject
  swaggerPath: string
}): { schema?: TFormSchemaNode; error?: string } => {
  const content = requestBody.content

  if (!content || Object.keys(content).length === 0) {
    return {
      error: `requestBody with no content: ${JSON.stringify(requestBody, null, 2)}`,
    }
  }

  const preferredMediaType =
    PREFERRED_MEDIA_TYPES.find(mediaType => content[mediaType]) ??
    Object.keys(content).find(mediaType => mediaType.includes('json')) ??
    Object.keys(content).find(mediaType => mediaType.includes('yaml')) ??
    Object.keys(content)[0]

  if (!preferredMediaType) {
    return {
      error: `requestBody with no supported media type for ${swaggerPath}: ${JSON.stringify(content, null, 2)}`,
    }
  }

  const mediaTypeObject = content[preferredMediaType]

  if (!mediaTypeObject) {
    return {
      error: `requestBody content missing selected media type "${preferredMediaType}" for ${swaggerPath}`,
    }
  }

  const schemaObject = mediaTypeObject.schema

  if (!schemaObject) {
    return {
      error: `mediaTypeObject with no schema:${JSON.stringify(mediaTypeObject, null, 2)}`,
    }
  }

  if (isReferenceObject(schemaObject)) {
    return {
      schema: schemaObject as unknown as TFormSchemaNode,
      error: 'Underefed schema',
    }
  }

  return {
    schema: schemaObject as TFormSchemaNode,
  }
}

export const getBodyParametersSchemaFromV3 = ({
  swaggerPathValue,
  swaggerPath,
}: {
  swaggerPathValue?: OpenAPIV3.PathItemObject
  swaggerPath: string
}): {
  bodyParametersSchema: TFormSchemaNode | undefined
  kind?: string
  error?: string
} => {
  const postData = swaggerPathValue?.post

  if (!postData) {
    const error = `No post data for ${swaggerPath}`
    return { bodyParametersSchema: undefined, kind: undefined, error }
  }

  const requestBody = postData.requestBody

  if (!requestBody) {
    const error = `postData with no requestBody: ${JSON.stringify(postData, null, 2)}`
    return { bodyParametersSchema: undefined, kind: undefined, error }
  }

  if (isReferenceObject(requestBody)) {
    const error = `Underefed requestBody for ${swaggerPath}`
    return { bodyParametersSchema: undefined, kind: undefined, error }
  }

  const { schema, error: schemaError } = getMediaTypeSchema({
    requestBody,
    swaggerPath,
  })

  if (schemaError || !schema) {
    return { bodyParametersSchema: schema, kind: undefined, error: schemaError }
  }

  const kindFromExtension = getKindFromExtension(
    (postData as { 'x-kubernetes-group-version-kind'?: unknown })['x-kubernetes-group-version-kind'],
  )
  const kind = kindFromExtension ?? getKindFromSchema(schema)

  if (!kind) {
    const error = `Unable to resolve kind from v3 operation/schema for ${swaggerPath}`
    return { bodyParametersSchema: schema, kind: undefined, error }
  }

  return {
    bodyParametersSchema: schema,
    kind,
    error: undefined,
  }
}
