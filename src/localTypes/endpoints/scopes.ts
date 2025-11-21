import { THeaders } from './common'
import { TApiGroupResourceTypeList, TBuiltinResourceTypeList } from '../k8s'

/* check */
export type TCheckIfApiInstanceNamespaceScopedReq = {
  body: {
    plural: string
    apiGroup: string
    apiVersion: string
    cluster: string
  }
} & THeaders

export type TCheckIfApiInstanceNamespaceScopedRes = {
  isClusterWide: boolean
  isNamespaceScoped: boolean
}

export type TCheckIfBuiltInInstanceNamespaceScopedReq = {
  body: {
    plural: string
    cluster: string
  }
} & THeaders

export type TCheckIfBuiltInInstanceNamespaceScopedRes = {
  isClusterWide: boolean
  isNamespaceScoped: boolean
}

/* filter */
export type TFilterIfApiInstanceNamespaceScopedReq = {
  body: {
    namespace?: string
    data?: TApiGroupResourceTypeList
    apiGroup: string
    apiVersion: string
    cluster: string
  }
} & THeaders

export type TFilterIfApiInstanceNamespaceScopedRes = TApiGroupResourceTypeList['resources'] | undefined

export type TFilterIfBuiltInInstanceNamespaceScopedReq = {
  body: {
    namespace?: string
    data?: TBuiltinResourceTypeList
    cluster: string
  }
} & THeaders

export type TFilterIfBuiltInInstanceNamespaceScopedRes = TBuiltinResourceTypeList['resources'] | undefined
