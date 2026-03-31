import _ from 'lodash'
import { TFormPrefillRaw, TFormPrefillValueEntry, TFormPrefillValuesObject } from 'src/localTypes/formExtensions'
import { prepareTemplate } from 'src/utils/prepareTemplate'

const isCanonicalValueEntry = (value: unknown): value is TFormPrefillValueEntry => {
  if (!_.isPlainObject(value)) return false

  const obj = value as Record<string, unknown>
  return Array.isArray(obj.path) && Object.prototype.hasOwnProperty.call(obj, 'value')
}

const isCanonicalValues = (values: unknown): values is TFormPrefillValueEntry[] =>
  Array.isArray(values) && values.every(isCanonicalValueEntry)

const resolveTemplateStringsInValue = ({
  node,
  replaceValues,
}: {
  node: unknown
  replaceValues: Record<string, string | undefined>
}): unknown => {
  if (typeof node === 'string') {
    return prepareTemplate({ template: node, replaceValues })
  }

  if (Array.isArray(node)) {
    return node.map(value => resolveTemplateStringsInValue({ node: value, replaceValues }))
  }

  if (_.isPlainObject(node)) {
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>).map(([key, value]) => [
        key,
        resolveTemplateStringsInValue({ node: value, replaceValues }),
      ]),
    )
  }

  return node
}

export const resolveFormPrefillPartsOfUrl = ({
  prefill,
  partsOfUrl,
}: {
  prefill?: TFormPrefillRaw
  partsOfUrl?: string[]
}): TFormPrefillRaw | undefined => {
  if (!prefill || !partsOfUrl?.length) return prefill

  const replaceValues = partsOfUrl.reduce<Record<string, string | undefined>>((acc, value, index) => {
    acc[index.toString()] = value
    return acc
  }, {})

  const values = prefill.spec.values

  if (isCanonicalValues(values)) {
    return {
      ...prefill,
      spec: {
        ...prefill.spec,
        values: values.map(entry => ({
          ...entry,
          value: resolveTemplateStringsInValue({ node: entry.value, replaceValues }),
        })),
      },
    }
  }

  return {
    ...prefill,
    spec: {
      ...prefill.spec,
      values: resolveTemplateStringsInValue({
        node: values,
        replaceValues,
      }) as TFormPrefillValuesObject,
    },
  }
}
