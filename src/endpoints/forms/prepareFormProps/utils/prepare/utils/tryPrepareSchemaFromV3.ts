import { TPrepareSchemaSourceData, TPrepareSchemaSourceResult } from './prepareSchemaSourceResult'

/**
 * Stage 4 intentionally introduces only the v3-first orchestration contract.
 * The actual v3 discovery/cache and schema extraction arrive in the next step.
 */
export const tryPrepareSchemaFromV3 = async ({
  data,
}: {
  data: TPrepareSchemaSourceData
}): Promise<TPrepareSchemaSourceResult> => {
  void data

  return {
    source: 'v3',
    status: 'unavailable',
    error: 'OpenAPI v3 schema source is not implemented yet',
  }
}
