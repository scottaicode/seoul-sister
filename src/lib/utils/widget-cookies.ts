const COOKIE_KEY = 'yuri_widget_session'
export const MAX_FREE_MESSAGES = 5

export function getMessageCount(): number {
  if (typeof document === 'undefined') return 0
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${COOKIE_KEY}=`))
  return match ? parseInt(match.split('=')[1], 10) || 0 : 0
}

export function setMessageCount(count: number) {
  const expires = new Date(Date.now() + 86400000).toUTCString()
  document.cookie = `${COOKIE_KEY}=${count};expires=${expires};path=/;SameSite=Lax`
}

export function incrementWidgetMessageCount(): number {
  const next = getMessageCount() + 1
  setMessageCount(next)
  return next
}

export function getRemainingWidgetMessages(): number {
  return MAX_FREE_MESSAGES - getMessageCount()
}
