// helpers/computePersistedAPPaths.ts
import _ from 'lodash'
import { TJSON } from 'src/localTypes/JSON'

const toBaseStringPath = (path: (string | number)[]): string[] =>
  // keep even indices (object keys), then coerce each segment to string
  path.filter((_, i) => i % 2 === 0).map(seg => String(seg))

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)

export const computePersistedAPPaths = ({
  pathsWithAdditionalProperties,
  prefillValuesSchema,
}: {
  pathsWithAdditionalProperties: (string | number)[][]
  prefillValuesSchema?: TJSON
}): string[][] =>
  !prefillValuesSchema
    ? []
    : _(pathsWithAdditionalProperties)
        .map(toBaseStringPath) // (string|number)[] -> string[]
        .map(basePath => ({
          basePath,
          container: _.get(prefillValuesSchema as Record<string, unknown>, basePath.join('.')),
        }))
        .filter(({ container }) => isRecord(container) && !_.isEmpty(container))
        .flatMap(({ basePath, container }) =>
          Object.keys(container as Record<string, unknown>).map(
            key => [...basePath, key], // string[]
          ),
        )
        .value()
