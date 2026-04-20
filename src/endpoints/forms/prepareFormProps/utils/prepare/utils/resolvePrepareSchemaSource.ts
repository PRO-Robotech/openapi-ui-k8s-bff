import { TPrepareSchemaSourceData, TPrepareSchemaSourceResult } from './prepareSchemaSourceResult'
import { tryPrepareSchemaFromV2 } from './tryPrepareSchemaFromV2'
import { tryPrepareSchemaFromV3 } from './tryPrepareSchemaFromV3'

export const resolvePrepareSchemaSource = async ({
  data,
}: {
  data: TPrepareSchemaSourceData
}): Promise<TPrepareSchemaSourceResult> => {
  const v3Result = await tryPrepareSchemaFromV3({ data })

  if (v3Result.status === 'success' || v3Result.status === 'unsupported') {
    return v3Result
  }

  return tryPrepareSchemaFromV2({ data })
}
