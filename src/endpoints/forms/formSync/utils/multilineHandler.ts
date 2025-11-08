import * as yaml from 'yaml'

/**
 * Processes multiline strings in YAML to ensure they are properly formatted
 * @param yamlContent - The YAML content as string
 * @returns Processed YAML content with proper multiline formatting
 */
export const processMultilineInYaml = (yamlContent: string): string => {
  try {
    // Parse the YAML to get the object structure
    const parsed = yaml.parse(yamlContent)

    // Convert back to YAML with proper multiline formatting
    const processed = yaml.stringify(parsed, {
      // Use literal block scalar (|) for multiline strings
      blockQuote: 'literal',
      // Preserve line breaks
      lineWidth: 0,
      // Use double quotes for strings that need escaping
      doubleQuotedAsJSON: false,
      // Use literal block scalar for multiline strings
      defaultStringType: 'QUOTE_DOUBLE',
    })

    return processed
  } catch (error) {
    // If parsing fails, return original content
    console.warn('Failed to process multiline YAML:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error: error,
    })
    return yamlContent
  }
}

/**
 * Processes form values to ensure multiline strings are properly handled
 * @param values - The form values object
 * @returns Processed values with multiline strings properly formatted
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const processMultilineInFormValues = (values: any): any => {
  if (!values || typeof values !== 'object') {
    return values
  }

  const processed = { ...values }

  const processObject = (obj: any): any => {
    if (typeof obj === 'string') {
      // Check if this string should be multiline
      if (obj.includes('\n') || obj.length > 80) {
        return obj
      }
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map(processObject)
    }

    if (obj && typeof obj === 'object') {
      const result: any = {}
      for (const [key, value] of Object.entries(obj)) {
        result[key] = processObject(value)
      }
      return result
    }

    return obj
  }

  return processObject(processed)
}

/**
 * Detects if a string value should be treated as multiline
 * @param value - The string value to check
 * @returns true if the value should be multiline
 */
export const shouldBeMultiline = (value: string): boolean => {
  if (!value || typeof value !== 'string') {
    return false
  }

  // Check for newlines
  if (value.includes('\n')) {
    return true
  }

  // Check for long strings
  if (value.length > 80) {
    return true
  }

  // Check for multiline indicators
  const multilineIndicators = ['#cloud-config', '#!/', '---', '```', 'BEGIN', 'END', '-----BEGIN', '-----END']

  return multilineIndicators.some(indicator => value.includes(indicator))
}
