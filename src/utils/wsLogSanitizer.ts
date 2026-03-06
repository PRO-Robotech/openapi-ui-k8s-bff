import { WS_LOG_BLACKLIST_PATHS, WS_LOG_PATH_FILTERS_ENABLED, WS_LOG_WHITELIST_PATHS } from 'src/constants/envs'

type TWsLogSanitizerOptions = {
  blacklistPaths?: string[]
  whitelistPaths?: string[]
}

type TPathTokens = string[]

const normalizePaths = (paths: string[]) =>
  paths
    .map(path => path.trim())
    .filter(Boolean)
    .map(path =>
      path
        .split('.')
        .map(part => part.trim())
        .filter(Boolean),
    )
    .filter(path => path.length > 0)

const isObjectLike = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

/**
 * Does `pattern` match a prefix of `path`? i.e. pattern matches path[0..k] for some k <= path.length.
 * Supports `*` (one segment) and `**` (zero or more segments).
 */
const isGlobPrefixOf = (pattern: TPathTokens, path: TPathTokens, pi = 0, si = 0): boolean => {
  if (pi >= pattern.length) return true

  const token = pattern[pi]

  if (token === '**') {
    // skip: ** matches zero segments
    if (isGlobPrefixOf(pattern, path, pi + 1, si)) return true
    // consume: ** eats one segment, stays active
    if (si < path.length && isGlobPrefixOf(pattern, path, pi, si + 1)) return true
    return false
  }

  if (si >= path.length) return false

  if (token === '*' || token === path[si]) {
    return isGlobPrefixOf(pattern, path, pi + 1, si + 1)
  }

  return false
}

/**
 * Can `partialPath` be extended to fully match `pattern`?
 * Supports `*` (one segment) and `**` (zero or more segments).
 */
const canLeadToGlobMatch = (pattern: TPathTokens, partialPath: TPathTokens, pi = 0, si = 0): boolean => {
  if (si >= partialPath.length) return true

  if (pi >= pattern.length) return false

  const token = pattern[pi]

  if (token === '**') {
    // skip: ** matches zero segments
    if (canLeadToGlobMatch(pattern, partialPath, pi + 1, si)) return true
    // consume: ** eats one segment, stays active
    if (canLeadToGlobMatch(pattern, partialPath, pi, si + 1)) return true
    return false
  }

  if (token === '*' || token === partialPath[si]) {
    return canLeadToGlobMatch(pattern, partialPath, pi + 1, si + 1)
  }

  return false
}

const hasDescendantPath = (paths: TPathTokens[], currentPath: TPathTokens): boolean =>
  paths.some(path => canLeadToGlobMatch(path, currentPath))

const hasAncestorPath = (paths: TPathTokens[], currentPath: TPathTokens): boolean =>
  paths.some(path => isGlobPrefixOf(path, currentPath))

const cloneValue = (value: unknown, seen = new WeakMap<object, unknown>()): unknown => {
  if (Array.isArray(value)) {
    return value.map(item => cloneValue(item, seen))
  }

  if (!isObjectLike(value)) {
    return value
  }

  if (value instanceof Date) {
    return new Date(value.getTime())
  }

  if (Buffer.isBuffer(value)) {
    return Buffer.from(value)
  }

  if (seen.has(value)) {
    return '[Circular]'
  }

  const result: Record<string, unknown> = {}
  seen.set(value, result)

  for (const key of Object.getOwnPropertyNames(value)) {
    result[key] = cloneValue((value as Record<string, unknown>)[key], seen)
  }

  return result
}

const sanitizeWithWhitelist = (
  value: unknown,
  whitelistPaths: TPathTokens[],
  currentPath: TPathTokens = [],
): unknown => {
  if (hasAncestorPath(whitelistPaths, currentPath)) {
    return cloneValue(value)
  }

  if (!hasDescendantPath(whitelistPaths, currentPath)) {
    return undefined
  }

  if (Array.isArray(value)) {
    const items = value
      .map(item => sanitizeWithWhitelist(item, whitelistPaths, currentPath))
      .filter(item => item !== undefined)
    return items.length > 0 ? items : undefined
  }

  if (!isObjectLike(value)) {
    return undefined
  }

  const result: Record<string, unknown> = {}

  for (const key of Object.getOwnPropertyNames(value)) {
    const nextPath = [...currentPath, key]
    const sanitized = sanitizeWithWhitelist((value as Record<string, unknown>)[key], whitelistPaths, nextPath)
    if (sanitized !== undefined) {
      result[key] = sanitized
    }
  }

  return Object.keys(result).length > 0 ? result : undefined
}

const sanitizeWithBlacklist = (
  value: unknown,
  blacklistPaths: TPathTokens[],
  currentPath: TPathTokens = [],
): unknown => {
  if (hasAncestorPath(blacklistPaths, currentPath)) {
    return undefined
  }

  if (!hasDescendantPath(blacklistPaths, currentPath)) {
    return cloneValue(value)
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeWithBlacklist(item, blacklistPaths, currentPath))
  }

  if (!isObjectLike(value)) {
    return cloneValue(value)
  }

  const result: Record<string, unknown> = {}

  for (const key of Object.getOwnPropertyNames(value)) {
    const nextPath = [...currentPath, key]
    const sanitized = sanitizeWithBlacklist((value as Record<string, unknown>)[key], blacklistPaths, nextPath)
    if (sanitized !== undefined) {
      result[key] = sanitized
    }
  }

  return result
}

const resolvePaths = (options?: TWsLogSanitizerOptions) => ({
  blacklistPaths: normalizePaths(options?.blacklistPaths ?? WS_LOG_BLACKLIST_PATHS),
  whitelistPaths: normalizePaths(options?.whitelistPaths ?? WS_LOG_WHITELIST_PATHS),
})

export const hasWsLogPathFilters = (options?: TWsLogSanitizerOptions): boolean => {
  const { blacklistPaths, whitelistPaths } = resolvePaths(options)
  return whitelistPaths.length > 0 || blacklistPaths.length > 0
}

export const sanitizeWsLogPayload = (payload: unknown, options?: TWsLogSanitizerOptions): unknown => {
  const { blacklistPaths, whitelistPaths } = resolvePaths(options)

  if (whitelistPaths.length > 0) {
    return sanitizeWithWhitelist(payload, whitelistPaths)
  }

  if (blacklistPaths.length > 0) {
    return sanitizeWithBlacklist(payload, blacklistPaths)
  }

  return payload
}

export const formatWsLogInput = <TRaw>(
  rawFallback: TRaw,
  structuredPayload: unknown,
  options?: TWsLogSanitizerOptions,
) => (hasWsLogPathFilters(options) ? sanitizeWsLogPayload(structuredPayload, options) : rawFallback)

export const getWsRawMessageMetadata = (rawMessage: Buffer | string) => ({
  rawMessageLength: typeof rawMessage === 'string' ? Buffer.byteLength(rawMessage, 'utf8') : rawMessage.length,
})

export { WS_LOG_PATH_FILTERS_ENABLED }
export type { TWsLogSanitizerOptions }
