/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  TAdditionalPrinterColumns,
  TAdditionalPrinterColumnsUndefinedValues,
  TAdditionalPrinterColumnsTrimLengths,
  TAdditionalPrinterColumnsColWidths,
  TAdditionalPrinterColumnsDisableSortersAndFilters,
} from 'src/localTypes/tableExtensions'

export const isWithAdditionalPrinterColumns = (
  x: any,
): x is { spec: { additionalPrinterColumns: TAdditionalPrinterColumns } } => {
  if (
    typeof x === 'object' &&
    !Array.isArray(x) &&
    x !== null &&
    x.spec &&
    typeof x.spec === 'object' &&
    !Array.isArray(x.spec) &&
    x.spec !== null &&
    Array.isArray(x.spec.additionalPrinterColumns) &&
    x.spec.additionalPrinterColumns.every(
      // (el: any) => Object.keys(el).includes('name') && Object.keys(el).includes('jsonPath'),
      // Now there is no need in names, cuz factory is supported inside and relays on full record
      (el: any) => Object.keys(el).includes('name'),
    )
  ) {
    return true
  }
  return false
}

export const isWithAdditionalPrinterColumnsUndefinedValues = (
  x: any,
): x is { spec: { additionalPrinterColumnsUndefinedValues: TAdditionalPrinterColumnsUndefinedValues } } => {
  if (
    typeof x === 'object' &&
    !Array.isArray(x) &&
    x !== null &&
    x.spec &&
    typeof x.spec === 'object' &&
    !Array.isArray(x.spec) &&
    x.spec !== null &&
    Array.isArray(x.spec.additionalPrinterColumnsUndefinedValues) &&
    x.spec.additionalPrinterColumnsUndefinedValues.every(
      (el: any) => Object.keys(el).includes('key') && Object.keys(el).includes('value'),
    )
  ) {
    return true
  }
  return false
}

export const isWithAdditionalPrinterColumnsTrimLengths = (
  x: any,
): x is { spec: { additionalPrinterColumnsTrimLengths: TAdditionalPrinterColumnsTrimLengths } } => {
  if (
    typeof x === 'object' &&
    !Array.isArray(x) &&
    x !== null &&
    x.spec &&
    typeof x.spec === 'object' &&
    !Array.isArray(x.spec) &&
    x.spec !== null &&
    Array.isArray(x.spec.additionalPrinterColumnsTrimLengths) &&
    x.spec.additionalPrinterColumnsTrimLengths.every(
      (el: any) => Object.keys(el).includes('key') && Object.keys(el).includes('value'),
    )
  ) {
    return true
  }
  return false
}

export const isWithAdditionalPrinterColumnsColWidths = (
  x: any,
): x is { spec: { additionalPrinterColumnsColWidths: TAdditionalPrinterColumnsColWidths } } => {
  if (
    typeof x === 'object' &&
    !Array.isArray(x) &&
    x !== null &&
    x.spec &&
    typeof x.spec === 'object' &&
    !Array.isArray(x.spec) &&
    x.spec !== null &&
    Array.isArray(x.spec.additionalPrinterColumnsColWidths) &&
    x.spec.additionalPrinterColumnsColWidths.every(
      (el: any) => Object.keys(el).includes('key') && Object.keys(el).includes('value'),
    )
  ) {
    return true
  }
  return false
}

export const isWithAdditionalPrinterColumnsDisableSortersAndFilters = (
  x: any,
): x is {
  spec: { additionalPrinterColumnsDisableSortersAndFilters: TAdditionalPrinterColumnsDisableSortersAndFilters }
} => {
  if (
    typeof x === 'object' &&
    !Array.isArray(x) &&
    x !== null &&
    x.spec &&
    typeof x.spec === 'object' &&
    !Array.isArray(x.spec) &&
    x.spec !== null &&
    Array.isArray(x.spec.additionalPrinterColumnsDisableSortersAndFilters) &&
    x.spec.additionalPrinterColumnsDisableSortersAndFilters.every(
      (el: any) => typeof el === 'string' || typeof el === 'number',
    )
  ) {
    return true
  }
  return false
}
