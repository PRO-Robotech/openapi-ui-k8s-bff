export const parseJsonEnvStringArray = (value: string | undefined, envName: string): string[] => {
  if (!value || value.trim().length === 0) {
    return []
  }

  try {
    const parsed = JSON.parse(value)

    if (!Array.isArray(parsed)) {
      console.warn(`[envs]: ${envName} must be a JSON array of strings`)
      return []
    }

    return parsed.map(item => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
  } catch (error) {
    console.warn(`[envs]: Failed to parse ${envName}; expected a JSON array of strings`, {
      message: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}
