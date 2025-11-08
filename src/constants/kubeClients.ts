// kube-client.ts
import fs from 'fs'
import path from 'path'
import {
  KubeConfig,
  // Core and groups
  CoreV1Api,
  AppsV1Api,
  BatchV1Api,
  AutoscalingV1Api,
  AutoscalingV2Api,
  NetworkingV1Api,
  RbacAuthorizationV1Api,
  PolicyV1Api,
  SchedulingV1Api,
  StorageV1Api,
  CertificatesV1Api,
  CoordinationV1Api,
  EventsV1Api,
  AuthenticationV1Api,
  AuthorizationV1Api,
  DiscoveryV1Api,
  ApiregistrationV1Api,
  ApiextensionsV1Api,
  AdmissionregistrationV1Api,
  // Misc / utility
  VersionApi,
  CustomObjectsApi,
  // Types for discovery payloads
  V1APIGroupList,
  V1APIVersions,
  V1APIResourceList,
} from '@kubernetes/client-node'
import { KUBE_API_URL, DEV_KUBE_API_URL, DEVELOPMENT } from './envs'

type TKubeClientsSurface = {
  // Core
  core: CoreV1Api
  apps: AppsV1Api

  // Workloads / scheduling / controllers
  batch: BatchV1Api
  autoscalingV1: AutoscalingV1Api
  autoscalingV2: AutoscalingV2Api
  scheduling: SchedulingV1Api

  // Networking / policy / RBAC
  networking: NetworkingV1Api
  policy: PolicyV1Api
  rbac: RbacAuthorizationV1Api

  // Platform infra
  storage: StorageV1Api
  certificates: CertificatesV1Api
  coordination: CoordinationV1Api
  events: EventsV1Api

  // AuthN/Z
  authentication: AuthenticationV1Api
  authorization: AuthorizationV1Api

  // Discovery / registration / extensions / admission
  discovery: DiscoveryV1Api
  apiregistration: ApiregistrationV1Api
  apiextensions: ApiextensionsV1Api
  admissionregistration: AdmissionregistrationV1Api

  // Version info
  version: VersionApi

  // CRDs
  customObjects: CustomObjectsApi
}

type TDiscoveryHelpers = {
  getApiGroups: (signal?: AbortSignal) => Promise<V1APIGroupList>
  getCoreApiVersions: (signal?: AbortSignal) => Promise<V1APIVersions>
  getResourcesFor: (group: string, version: string, signal?: AbortSignal) => Promise<V1APIResourceList>
}

type TRequestOptionsLike = {
  headers?: Record<string, string>
  // allow extra fields the client sets internally
  [key: string]: any
}

type THasAddInterceptor = {
  addInterceptor: (fn: (opts: TRequestOptionsLike) => void | Promise<void>) => void
}

/**
 * Preserve original in-cluster file logic + logs
 */
const serviceAccountDir = '/var/run/secrets/kubernetes.io/serviceaccount'
const caPath = path.join(serviceAccountDir, 'ca.crt')
const tokenPath = path.join(serviceAccountDir, 'token')

let ca: Buffer | undefined
if (fs.existsSync(caPath)) {
  ca = fs.readFileSync(caPath)
  console.log('✅ Using incluster CA')
}

let bearerToken: string | undefined
if (fs.existsSync(tokenPath)) {
  bearerToken = fs.readFileSync(tokenPath, 'utf8').trim()
  console.log('✅ Using incluster ServiceAccount token')
}

export const baseUrl = DEVELOPMENT ? DEV_KUBE_API_URL : KUBE_API_URL

const buildCluster = () => {
  return DEVELOPMENT
    ? { name: 'cluster', server: baseUrl, skipTLSVerify: true }
    : {
        name: 'cluster',
        server: baseUrl,
        caData: ca ? ca.toString('base64') : undefined,
        skipTLSVerify: false,
      }
}

/** ---------- Admin (SA) client: like old kubeApi ---------- */
const buildSaKubeConfig = (): KubeConfig => {
  const kc = new KubeConfig()
  const cluster = buildCluster()

  kc.loadFromOptions({
    clusters: [cluster],
    users: [
      // SA auth ONLY here
      DEVELOPMENT ? { name: 'dev', token: undefined } : { name: 'sa', token: bearerToken },
    ],
    contexts: [{ name: 'ctx', user: DEVELOPMENT ? 'dev' : 'sa', cluster: 'cluster' }],
    currentContext: 'ctx',
  })

  return kc
}

const kcSa = buildSaKubeConfig()

export const kubeCore: CoreV1Api = kcSa.makeApiClient(CoreV1Api)
export const kubeApps: AppsV1Api = kcSa.makeApiClient(AppsV1Api)

export const allApis: TKubeClientsSurface = {
  // Core
  core: kubeCore,
  apps: kubeApps,

  // Workloads / scheduling / controllers
  batch: kcSa.makeApiClient(BatchV1Api),
  autoscalingV1: kcSa.makeApiClient(AutoscalingV1Api),
  autoscalingV2: kcSa.makeApiClient(AutoscalingV2Api),
  scheduling: kcSa.makeApiClient(SchedulingV1Api),

  // Networking / policy / RBAC
  networking: kcSa.makeApiClient(NetworkingV1Api),
  policy: kcSa.makeApiClient(PolicyV1Api),
  rbac: kcSa.makeApiClient(RbacAuthorizationV1Api),

  // Platform infra
  storage: kcSa.makeApiClient(StorageV1Api),
  certificates: kcSa.makeApiClient(CertificatesV1Api),
  coordination: kcSa.makeApiClient(CoordinationV1Api),
  events: kcSa.makeApiClient(EventsV1Api),

  // AuthN/Z
  authentication: kcSa.makeApiClient(AuthenticationV1Api),
  authorization: kcSa.makeApiClient(AuthorizationV1Api),

  // Discovery / registration / extensions / admission
  discovery: kcSa.makeApiClient(DiscoveryV1Api),
  apiregistration: kcSa.makeApiClient(ApiregistrationV1Api),
  apiextensions: kcSa.makeApiClient(ApiextensionsV1Api),
  admissionregistration: kcSa.makeApiClient(AdmissionregistrationV1Api),

  // Version info
  version: kcSa.makeApiClient(VersionApi),

  // CRDs
  customObjects: kcSa.makeApiClient(CustomObjectsApi),
}

/**
 * ---- API discovery helpers (v1 everything) ----
 * Lightweight wrappers using the underlying client's raw `request` method.
 */
// const rawGet = async <T>(client: any, path: string, signal?: AbortSignal): Promise<T> => {
//   const opts: any = { method: 'GET', uri: `${baseUrl}${path}` }
//   if (DEVELOPMENT) opts.rejectUnauthorized = false
//   if (signal) opts.signal = signal
//   return client.request(opts).then((res: any) => (res.body ? JSON.parse(res.body) : res))
// }

// /** List non-core API groups (GET /apis) */
// export const getApiGroups = async (signal?: AbortSignal): Promise<V1APIGroupList> => {
//   return rawGet(allApis.core, '/apis', signal)
// }

// /** List core API versions (GET /api) */
// export const getCoreApiVersions = async (signal?: AbortSignal): Promise<V1APIVersions> => {
//   return rawGet(allApis.core, '/api', signal)
// }

// /** List resources for a given group/version (GET /apis/{group}/{version}) */
// export const getResourcesFor = async (
//   group: string,
//   version: string,
//   signal?: AbortSignal,
// ): Promise<V1APIResourceList> => {
//   const path = `/apis/${group}/${version}`
//   return rawGet(allApis.core, path, signal)
// }

/** ---------- User-proxied client: STRICTLY no SA auth ---------- */
export const createUserKubeClient = (
  userHeaders: Record<string, string | string[] | undefined>,
): TKubeClientsSurface &
  TDiscoveryHelpers & {
    kubeConfig: KubeConfig // <-- expose KC for Watch
  } => {
  // Build a config with NO credentials at all
  const kc = new KubeConfig()
  const cluster = buildCluster()

  kc.loadFromOptions({
    clusters: [cluster as any],
    users: [{ name: 'user-proxy' }] as any, // no token, no certs, nothing
    contexts: [{ name: 'ctx', user: 'user-proxy', cluster: 'cluster' }],
    currentContext: 'ctx',
  })

  // Make all standard clients
  const clients: TKubeClientsSurface = {
    core: kc.makeApiClient(CoreV1Api),
    apps: kc.makeApiClient(AppsV1Api),
    batch: kc.makeApiClient(BatchV1Api),
    autoscalingV1: kc.makeApiClient(AutoscalingV1Api),
    autoscalingV2: kc.makeApiClient(AutoscalingV2Api),
    scheduling: kc.makeApiClient(SchedulingV1Api),
    networking: kc.makeApiClient(NetworkingV1Api),
    policy: kc.makeApiClient(PolicyV1Api),
    rbac: kc.makeApiClient(RbacAuthorizationV1Api),
    storage: kc.makeApiClient(StorageV1Api),
    certificates: kc.makeApiClient(CertificatesV1Api),
    coordination: kc.makeApiClient(CoordinationV1Api),
    events: kc.makeApiClient(EventsV1Api),
    authentication: kc.makeApiClient(AuthenticationV1Api),
    authorization: kc.makeApiClient(AuthorizationV1Api),
    discovery: kc.makeApiClient(DiscoveryV1Api),
    apiregistration: kc.makeApiClient(ApiregistrationV1Api),
    apiextensions: kc.makeApiClient(ApiextensionsV1Api),
    admissionregistration: kc.makeApiClient(AdmissionregistrationV1Api),
    version: kc.makeApiClient(VersionApi),
    customObjects: kc.makeApiClient(CustomObjectsApi),
  }

  const normalizeHeaders = (h: Record<string, string | string[] | undefined>): Record<string, string> =>
    Object.fromEntries(
      Object.entries(h)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : (v as string)]),
    )

  const normalizedHeaders = normalizeHeaders(userHeaders)

  // attach an interceptor per client to forward user headers
  const attachForwardedHeaders = (client: object): void => {
    const c = client as Partial<THasAddInterceptor>
    if (!c || typeof c.addInterceptor !== 'function') return

    c.addInterceptor((opts: TRequestOptionsLike) => {
      // merge headers
      const existing = opts.headers ?? {}
      opts.headers = { ...existing, ...normalizedHeaders }

      // dev TLS parity (like your previous rejectUnauthorized=false)
      if (DEVELOPMENT) {
        // for request/request-promise under the hood
        // both of these are recognized by the generator stack
        ;(opts as { strictSSL?: boolean }).strictSSL = false
        ;(opts as { rejectUnauthorized?: boolean }).rejectUnauthorized = false
      }
    })
  }
  Object.values(clients).forEach(attachForwardedHeaders)

  // Provide the same discovery helpers, bound to these user clients
  const rawGetUser = async <T>(path: string, signal?: AbortSignal): Promise<T> => {
    const opts: any = { method: 'GET', uri: `${baseUrl}${path}` }
    if (DEVELOPMENT) opts.rejectUnauthorized = false
    if (signal) opts.signal = signal
    return (clients.core as any).request(opts).then((res: any) => (res.body ? JSON.parse(res.body) : res))
  }

  const helpers: TDiscoveryHelpers = {
    getApiGroups: (signal?: AbortSignal) => rawGetUser('/apis', signal),
    getCoreApiVersions: (signal?: AbortSignal) => rawGetUser('/api', signal),
    getResourcesFor: (group: string, version: string, signal?: AbortSignal) =>
      rawGetUser(`/apis/${group}/${version}`, signal),
  }

  return { ...clients, ...helpers, kubeConfig: kc }
}

/**
 * ---- Timeout parity (5s “fail fast”) ----
 * @kubernetes/client-node doesn’t expose a global client timeout.
 * To preserve your 5_000ms behavior, use an AbortController per request.
 *
 * Usage:
 *   const { signal, cancel } = requestTimeout(5000)
 *   await kubeCore.listNamespace(undefined, undefined, undefined, undefined, undefined, undefined, { signal })
 *   // or pass `signal` as the last options object where applicable
 */
/*
 * Usage examples:
 * // List pods in "default" with the same 5s timeout you had:
 * const { signal } = requestTimeout(5_000)
 * const pods = await kubeCore.listNamespacedPod({ namespace: 'default' }, { signal })
 *
 * // Using the “user” client (no default auth), also with timeout:
 * const { signal: sig2 } = requestTimeout()
 * const ns = await userCore.listNamespace({}, { sig2 })
 */
export const requestTimeout = (
  ms = 5_000,
): {
  signal: AbortSignal
  cancel: () => void
} => {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), ms)
  // give caller a way to cancel early if needed
  const cancel = () => clearTimeout(t)
  return { signal: controller.signal, cancel }
}
