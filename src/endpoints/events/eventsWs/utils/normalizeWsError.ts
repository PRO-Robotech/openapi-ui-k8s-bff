type TNormalizedWsError = {
  statusCode?: number
  reason?: string
  message: string
  userMessage: string
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const toStatusCode = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
  return undefined
}

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined

const resolveUserMessage = (statusCode: number | undefined, fallbackUserMessage: string): string => {
  if (statusCode === 403) return 'Access denied (403)'
  if (statusCode === 401) return 'Unauthorized (401)'
  if (typeof statusCode === 'number') return `${fallbackUserMessage} (${statusCode})`
  return fallbackUserMessage
}

export const normalizeWsError = (
  error: unknown,
  fallbackUserMessage = 'Initial events load failed',
): TNormalizedWsError => {
  const root = isRecord(error) ? error : {}
  const response = isRecord(root.response) ? root.response : {}
  const responseData = isRecord(response.data) ? response.data : {}
  const body = isRecord(root.body) ? root.body : {}

  const statusCode =
    toStatusCode(response.status) ??
    toStatusCode(root.statusCode) ??
    toStatusCode(root.status) ??
    toStatusCode(root.code) ??
    toStatusCode(body.code)

  const reason = readString(responseData.reason) ?? readString(root.reason) ?? readString(body.reason)

  const message =
    readString(responseData.message) ??
    readString(body.message) ??
    readString(root.message) ??
    (error instanceof Error ? error.message : undefined) ??
    String(error)

  return {
    statusCode,
    reason,
    message,
    userMessage: resolveUserMessage(statusCode, fallbackUserMessage),
  }
}

export type { TNormalizedWsError }
