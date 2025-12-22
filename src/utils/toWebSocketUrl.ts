export const toWebSocketUrl = (url: string): string => {
  if (url.startsWith('ws://') || url.startsWith('wss://')) {
    return url
  }
  if (url.startsWith('https://')) {
    return `wss://${url.slice('https://'.length)}`
  }
  if (url.startsWith('http://')) {
    return `ws://${url.slice('http://'.length)}`
  }
  // Fallback: leave as-is (caller will handle errors)
  return url
}


