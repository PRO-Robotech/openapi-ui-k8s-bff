import _ from 'lodash'
import { TFormPrefill } from 'src/localTypes/formExtensions'

const resolveNumericPlaceholders = (template: string, partsOfUrl: string[]): string =>
  template.replaceAll(/\{(\d+)\}/g, (_, index) => partsOfUrl[Number(index)] ?? '')

const resolveTemplateStringsInValue = ({
  node,
  partsOfUrl,
}: {
  node: unknown
  partsOfUrl: string[]
}): unknown => {
  if (typeof node === 'string') {
    return resolveNumericPlaceholders(node, partsOfUrl)
  }

  if (Array.isArray(node)) {
    return node.map(value => resolveTemplateStringsInValue({ node: value, partsOfUrl }))
  }

  if (_.isPlainObject(node)) {
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>).map(([key, value]) => [
        key,
        resolveTemplateStringsInValue({ node: value, partsOfUrl }),
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

  return {
    ...prefill,
    spec: {
      ...prefill.spec,
      values: prefill.spec.values.map(entry => ({
        ...entry,
        value: resolveTemplateStringsInValue({
          node: entry.value,
          partsOfUrl,
        }),
      })),
    },
  }
}
