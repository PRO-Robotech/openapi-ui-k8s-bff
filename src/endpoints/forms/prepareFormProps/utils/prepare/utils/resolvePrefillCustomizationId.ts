export const resolvePrefillCustomizationId = ({
  customizationId,
  customizationIdPrefill,
}: {
  customizationId?: string
  customizationIdPrefill?: string
}): string | undefined => customizationIdPrefill || customizationId
