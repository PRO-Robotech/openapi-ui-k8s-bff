import { TApiResources } from 'src/localTypes/k8s'
import {
  TAdditionalPrinterColumns,
  TAdditionalPrinterColumnsUndefinedValues,
  TAdditionalPrinterColumnsColWidths,
  TAdditionalPrinterColumnsTrimLengths,
  TAdditionalPrinterColumnsKeyTypeProps,
  TAdditionalPrinterColumnsDisableSortersAndFilters,
} from 'src/localTypes/tableExtensions'
import {
  isWithAdditionalPrinterColumns,
  isWithAdditionalPrinterColumnsUndefinedValues,
  isWithAdditionalPrinterColumnsColWidths,
  isWithAdditionalPrinterColumnsTrimLengths,
  isWithAdditionalPrinterColumnsDisableSortersAndFilters,
} from './guards'

/* eslint-disable @typescript-eslint/no-explicit-any */
export const parseColumnsOverrides = ({
  columnsOverridesData,
  customizationId,
}: {
  columnsOverridesData?: TApiResources
  customizationId?: string
}): {
  ensuredCustomOverrides?: TAdditionalPrinterColumns
  ensuredCustomOverridesUndefinedValues?: TAdditionalPrinterColumnsUndefinedValues
  ensuredCustomOverridesTrimLengths?: TAdditionalPrinterColumnsTrimLengths
  ensuredCustomOverridesColWidths?: TAdditionalPrinterColumnsColWidths
  ensuredCustomOverridesDisableSortersAndFilters?: TAdditionalPrinterColumnsDisableSortersAndFilters
  ensuredCustomOverridesKeyTypeProps?: TAdditionalPrinterColumnsKeyTypeProps
} => {
  if (!customizationId) {
    return {}
  }

  const specificCustomOverrides = columnsOverridesData?.items.find(
    item =>
      item.spec &&
      typeof item.spec === 'object' &&
      !Array.isArray(item.spec) &&
      item.spec !== null &&
      typeof item.spec.id === 'string' &&
      item.spec.id === customizationId,
  )

  const ensuredCustomOverrides = isWithAdditionalPrinterColumns(specificCustomOverrides)
    ? specificCustomOverrides.spec.additionalPrinterColumns
    : undefined

  const ensuredCustomOverridesUndefinedValues = isWithAdditionalPrinterColumnsUndefinedValues(specificCustomOverrides)
    ? specificCustomOverrides.spec.additionalPrinterColumnsUndefinedValues
    : undefined

  const ensuredCustomOverridesTrimLengths = isWithAdditionalPrinterColumnsTrimLengths(specificCustomOverrides)
    ? specificCustomOverrides.spec.additionalPrinterColumnsTrimLengths
    : undefined

  const ensuredCustomOverridesColWidths = isWithAdditionalPrinterColumnsColWidths(specificCustomOverrides)
    ? specificCustomOverrides.spec.additionalPrinterColumnsColWidths
    : undefined

  const ensuredCustomOverridesDisableSortersAndFilters = isWithAdditionalPrinterColumnsDisableSortersAndFilters(
    specificCustomOverrides,
  )
    ? specificCustomOverrides.spec.additionalPrinterColumnsDisableSortersAndFilters
    : undefined

  const ensuredCustomOverridesKeyTypeProps: TAdditionalPrinterColumnsKeyTypeProps = {}
  if (ensuredCustomOverrides) {
    ensuredCustomOverrides.forEach(({ name, type, customProps }) => {
      if (type) {
        ensuredCustomOverridesKeyTypeProps[name] = { type, customProps }
      }
    })
  }

  return {
    ensuredCustomOverrides,
    ensuredCustomOverridesUndefinedValues,
    ensuredCustomOverridesTrimLengths,
    ensuredCustomOverridesColWidths,
    ensuredCustomOverridesDisableSortersAndFilters,
    ensuredCustomOverridesKeyTypeProps:
      Object.keys(ensuredCustomOverridesKeyTypeProps).length === 0 ? undefined : ensuredCustomOverridesKeyTypeProps,
  }
}
