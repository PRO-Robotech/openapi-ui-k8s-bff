import dotenv from 'dotenv'

dotenv.config()

export const DEV_KUBE_API_URL = process.env.DEV_KUBE_API_URL || 'no-dev-kube-api-url'
export const BASE_API_GROUP = process.env.BASE_API_GROUP
export const BASE_API_VERSION = process.env.BASE_API_VERSION
export const BASEPREFIX = process.env.BASEPREFIX || ''
export const DEVELOPMENT = process.env.DEVELOPMENT === 'TRUE'
export const KUBE_API_URL = `https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT}`
export const DEBUG_CONTAINER_IMAGE = process.env.DEBUG_CONTAINER_IMAGE || 'no-container-image-in-env'

export const BASE_FRONTEND_PREFIX = process.env.BASE_FRONTEND_PREFIX
export const BASE_CLUSTERNAME = process.env.BASE_CLUSTERNAME

export const BASE_FACTORY_NAMESPACED_API_KEY = process.env.BASE_FACTORY_NAMESPACED_API_KEY
export const BASE_FACTORY_CLUSTERSCOPED_API_KEY = process.env.BASE_FACTORY_CLUSTERSCOPED_API_KEY
export const BASE_FACTORY_NAMESPACED_BUILTIN_KEY = process.env.BASE_FACTORY_NAMESPACED_BUILTIN_KEY
export const BASE_FACTORY_CLUSTERSCOPED_BUILTIN_KEY = process.env.BASE_FACTORY_CLUSTERSCOPED_BUILTIN_KEY
export const BASE_NAMESPACE_FACTORY_KEY = process.env.BASE_NAMESPACE_FACTORY_KEY

export const BASE_NAMESPACE_FULL_PATH = process.env.BASE_NAMESPACE_FULL_PATH || '/api/v1/namespaces'
