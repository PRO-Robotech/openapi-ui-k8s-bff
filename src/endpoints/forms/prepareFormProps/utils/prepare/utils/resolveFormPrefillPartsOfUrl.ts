import _ from 'lodash'
import { TFormPrefill } from 'src/localTypes/formExtensions'
import { prepareTemplate } from 'src/utils/prepareTemplate'

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
  prefill?: TFormPrefill
  partsOfUrl?: string[]
}): TFormPrefill | undefined => {
  if (!prefill || !partsOfUrl?.length) return prefill

  const replaceValues = partsOfUrl.reduce<Record<string, string | undefined>>((acc, value, index) => {
    acc[index.toString()] = value
    return acc
  }, {})

  return {
    ...prefill,
    spec: {
      ...prefill.spec,
      values: prefill.spec.values.map(entry => ({
        ...entry,
        value: resolveTemplateStringsInValue({
          node: entry.value,
          replaceValues,
        }),
      })),
    },
  }
}
