# openapi-ui-k8s-bff

## Express + TypeScript BFF for Kubernetes

An Express + TypeScript app that provides endpoints for data fetching/preparing and applying some customizations.
Support impersonation via proxing headers. Using CA for internal tasks. Caches dereffed OpenAPI scheme from k8s.

## ⚙️ Configuration

This app can be configured through environment variables.

| Variable                                 | Type     | Description                                                 |
| ---------------------------------------- | -------- | ----------------------------------------------------------- |
| `BASEPREFIX`                             | `string` | Base url for app                                            |
| `BASE_API_GROUP`                         | `string` | API group for customization resources. `front.in-cloud.io`  |
| `BASE_API_VERSION`                       | `string` | API version for customization resources. `v1alpha1`         |
| `BASE_NAVIGATION_RESOURCE_PLURAL`        | `string` | Resource plural name for navigation settings. `navigations` |
| `BASE_NAVIGATION_RESOURCE_NAME`          | `string` | Resource name for navigation settings. `navigation`         |
| `BASE_FRONTEND_PREFIX`                   | `string` | To build proper links to resources                          |
| `BASE_FACTORY_NAMESPACED_API_KEY`        | `string` | Base factory key for namespaced API resource                |
| `BASE_FACTORY_CLUSTERSCOPED_API_KEY`     | `string` | Base factory key for clusterscoped API resource             |
| `BASE_FACTORY_NAMESPACED_BUILTIN_KEY`    | `string` | Base factory key for namespaced api/v1 resource             |
| `BASE_FACTORY_CLUSTERSCOPED_BUILTIN_KEY` | `string` | Base factory key for clusterscoped api/v1 resource          |
| `BASE_NAMESPACE_FACTORY_KEY`             | `string` | Base factory key for namespace                              |
| `BASE_NAMESPACE_FULL_PATH`               | `string` | Resrouce full path if you use custom API resource for NS    |
| `BASE_ALLOWED_AUTH_HEADERS`              | `string` | White-listed req headers for impersonation                  |
| `MF_PLUGINS_NO_CLUSTER`                  | `string` | JSON for Plugins Manifest                                   |

Local development: This app can be also configured through more environment variables.

| Variable                  | Type     | Description                                                        |
| ------------------------- | -------- | ------------------------------------------------------------------ |
| `DEV_KUBE_API_URL`        | `string` | Full url to k8s proxy inside nginx inside port-forwarded container |
| `KUBERNETES_SERVICE_HOST` | `string` | Host from API url above                                            |
| `KUBERNETES_SERVICE_PORT` | `string` | Port from API url above                                            |

---

## 🤝 Contributing

[Check this out](./CONTRIBUTING.md)
