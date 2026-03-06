import dotenv from 'dotenv'
import { parseJsonEnvStringArray } from 'src/utils/parseJsonEnvStringArray'

dotenv.config()

export const DEVELOPMENT = process.env.DEVELOPMENT === 'TRUE'

export const DEV_KUBE_API_URL = process.env.DEV_KUBE_API_URL || 'no-dev-kube-api-url'
export const KUBE_API_URL = `https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT}`

export const BASEPREFIX = process.env.BASEPREFIX || ''

export const BASE_API_GROUP = process.env.BASE_API_GROUP
export const BASE_API_VERSION = process.env.BASE_API_VERSION

export const BASE_NAVIGATION_RESOURCE_PLURAL = process.env.BASE_NAVIGATION_RESOURCE_PLURAL
export const BASE_NAVIGATION_RESOURCE_NAME = process.env.BASE_NAVIGATION_RESOURCE_NAME

export const BASE_FRONTEND_PREFIX = process.env.BASE_FRONTEND_PREFIX

export const BASE_FACTORY_NAMESPACED_API_KEY = process.env.BASE_FACTORY_NAMESPACED_API_KEY
export const BASE_FACTORY_CLUSTERSCOPED_API_KEY = process.env.BASE_FACTORY_CLUSTERSCOPED_API_KEY
export const BASE_FACTORY_NAMESPACED_BUILTIN_KEY = process.env.BASE_FACTORY_NAMESPACED_BUILTIN_KEY
export const BASE_FACTORY_CLUSTERSCOPED_BUILTIN_KEY = process.env.BASE_FACTORY_CLUSTERSCOPED_BUILTIN_KEY
export const BASE_NAMESPACE_FACTORY_KEY = process.env.BASE_NAMESPACE_FACTORY_KEY

export const BASE_NAMESPACE_FULL_PATH = process.env.BASE_NAMESPACE_FULL_PATH || '/api/v1/namespaces'

export const BASE_ALLOWED_AUTH_HEADERS = process.env.BASE_ALLOWED_AUTH_HEADERS || ''

export const WS_LOG_WHITELIST_PATHS = parseJsonEnvStringArray(
  process.env.WS_LOG_WHITELIST_PATHS,
  'WS_LOG_WHITELIST_PATHS',
)
export const WS_LOG_BLACKLIST_PATHS = parseJsonEnvStringArray(
  process.env.WS_LOG_BLACKLIST_PATHS,
  'WS_LOG_BLACKLIST_PATHS',
)
export const WS_LOG_PATH_FILTERS_ENABLED = WS_LOG_WHITELIST_PATHS.length > 0 || WS_LOG_BLACKLIST_PATHS.length > 0
