import { TFormOverride } from 'src/localTypes/formExtensions'

export const getPathsFromOverride = ({
  specificCustomOverrides,
}: {
  specificCustomOverrides?: TFormOverride
}): {
  hiddenPaths?: string[][]
  expandedPaths?: string[][]
  persistedPaths?: string[][]
  sortPaths?: string[][]
} => {
  let hiddenPaths: string[][] | undefined
  let expandedPaths: string[][] | undefined
  let persistedPaths: string[][] | undefined
  let sortPaths: string[][] | undefined

  if (specificCustomOverrides) {
    if (specificCustomOverrides.spec.hidden) {
      hiddenPaths = specificCustomOverrides.spec.hidden
    }

    if (specificCustomOverrides.spec.expanded) {
      expandedPaths = specificCustomOverrides.spec.expanded
    }

    if (specificCustomOverrides.spec.persisted) {
      persistedPaths = specificCustomOverrides.spec.persisted
    }

    if (specificCustomOverrides.spec.sort) {
      sortPaths = specificCustomOverrides.spec.sort
    }
  }

  return { hiddenPaths, expandedPaths, persistedPaths, sortPaths }
}
