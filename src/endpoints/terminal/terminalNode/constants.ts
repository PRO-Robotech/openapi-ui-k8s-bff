export const WARMUP_MESSAGES = {
  NAMESPACE_CREATING: 'Namespace creating',
  NAMESPACE_CREATED: 'Namespace created',
  NAMESPACE_CREATE_ERROR: 'Namespace create error',
  POD_TEMPLATE_REQUIRED: 'Pod template is required',
  POD_CREATING: 'Pod creating',
  POD_CREATED: 'Pod created',
  POD_CREATE_ERROR: 'Pod create error',
  POD_TEMPLATE_VALIDATION_ERROR: 'Pod template validation error',
  CONTAINER_WAITING_READY: 'Container waiting ready',
  CONTAINER_NEVER_READY: 'Container never ready',
  CONTAINER_READY: 'Container ready',
  POD_WAITING_READY: 'Pod waiting ready',
  POD_NEVER_READY: 'Pod never ready',
  POD_READY: 'Pod ready',
}

export const SHUTDOWN_MESSAGES = {
  SHUTDOWN: 'Shutting down',
  POD_DELETED: 'Pod deleted',
  POD_DELETE_ERROR: 'Pod delete error',
  NAMESPACE_DELETED: 'Namespace deleted',
  NAMESPACE_DELETE_ERROR: 'Namespace delete error',
  CRITICAL: 'Clean up failed',
}

export const POD_WAITING = {
  POD_PENDING: 'Pod is pending',
  POD_RUNNING: 'Pod is running',
  POD_FAILED: 'Pod failed',
  POD_UNKNOWN: 'Pod status unknown',
}

export const CONTAINER_WAITING = {
  CONTAINER_NOT_READY: 'Container not ready yet',
  CONTAINER_TERMINATED: 'Container terminated with exit code',
  CONTAINER_NOT_FOUND: 'Container not found in pod status',
  CONTAINER_READY: 'Container is ready',
}
