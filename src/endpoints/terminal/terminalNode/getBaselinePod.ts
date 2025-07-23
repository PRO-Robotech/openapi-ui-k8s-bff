import { AxiosRequestConfig } from 'axios'
import { userKubeApi } from 'src/constants/httpAgent'
import { TProfileType } from './types'
import { CONTAINER_WAITING } from './constants'

export const getBaselinePod = ({
  namespace,
  podName,
  nodeName,
  containerImage,
  containerName,
}: {
  namespace: string
  podName: string
  nodeName: string
  containerImage: string
  containerName: string
}): Record<string, any> => {
  return {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: {
      name: podName,
      namespace,
    },
    spec: {
      containers: [
        {
          image: containerImage,
          imagePullPolicy: 'IfNotPresent',
          name: containerName,
          command: ['sleep'],
          args: ['infinity'],
          resources: {},
          terminationMessagePath: '/dev/termination-log',
          terminationMessagePolicy: 'File',
          volumeMounts: [
            {
              mountPath: '/var/run/secrets/kubernetes.io/serviceaccount',
              name: 'kube-api-access',
              readOnly: true,
            },
          ],
        },
      ],
      dnsPolicy: 'ClusterFirst',
      enableServiceLinks: true,
      nodeName,
      preemptionPolicy: 'PreemptLowerPriority',
      priority: 0,
      restartPolicy: 'Never',
      schedulerName: 'default-scheduler',
      securityContext: {},
      serviceAccount: 'default',
      serviceAccountName: 'default',
      terminationGracePeriodSeconds: 30,
      tolerations: [
        {
          operator: 'Exists',
        },
      ],
      volumes: [
        {
          name: 'kube-api-access',
          projected: {
            defaultMode: 420,
            sources: [
              {
                serviceAccountToken: {
                  expirationSeconds: 3607,
                  path: 'token',
                },
              },
              {
                configMap: {
                  items: [
                    {
                      key: 'ca.crt',
                      path: 'ca.crt',
                    },
                  ],
                  name: 'kube-root-ca.crt',
                },
              },
              {
                downwardAPI: {
                  items: [
                    {
                      fieldRef: {
                        apiVersion: 'v1',
                        fieldPath: 'metadata.namespace',
                      },
                      path: 'namespace',
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  }
}
