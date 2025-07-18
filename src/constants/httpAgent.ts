import fs from 'fs'
import path from 'path'
import https from 'https'
import axios, { AxiosInstance } from 'axios'
import { KUBE_API_URL, DEV_KUBE_API_URL, DEVELOPMENT } from './envs'

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

export const httpsAgent = new https.Agent({ ca, rejectUnauthorized: DEVELOPMENT ? false : true })

export const kubeApi: AxiosInstance = axios.create({
  baseURL: DEVELOPMENT ? DEV_KUBE_API_URL : KUBE_API_URL,
  httpsAgent,
  headers: DEVELOPMENT
    ? undefined
    : {
        // use the ServiceAccount token for authentication
        Authorization: `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      },
  // (optionally) short timeouts so your BFF fails fast if the API is unreachable
  timeout: 5_000,
})

export const userKubeApi: AxiosInstance = axios.create({
  baseURL: DEVELOPMENT ? DEV_KUBE_API_URL : KUBE_API_URL,
  httpsAgent,
  // (optionally) short timeouts so your BFF fails fast if the API is unreachable
  timeout: 5_000,
})
