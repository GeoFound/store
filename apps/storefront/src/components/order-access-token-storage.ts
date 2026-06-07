const ORDER_ACCESS_TOKEN_SESSION_KEY = "store_session_order_access_token"
const LEGACY_ORDER_ACCESS_TOKEN_KEY = "store_last_order_access_token"

export function readInitialOrderAccessToken() {
  if (typeof window === "undefined") {
    return ""
  }

  const params = new URLSearchParams(window.location.search)
  const queryToken = params.get("access_token") || ""
  const sessionToken =
    window.sessionStorage.getItem(ORDER_ACCESS_TOKEN_SESSION_KEY) || ""
  const legacyToken =
    window.localStorage.getItem(LEGACY_ORDER_ACCESS_TOKEN_KEY) || ""
  const resolvedToken = queryToken || sessionToken || legacyToken

  if (resolvedToken) {
    persistOrderAccessToken(resolvedToken)
  }

  return resolvedToken
}

export function persistOrderAccessToken(token: string) {
  const normalizedToken = token.trim()

  if (!normalizedToken) {
    return
  }

  window.sessionStorage.setItem(
    ORDER_ACCESS_TOKEN_SESSION_KEY,
    normalizedToken
  )
  window.localStorage.removeItem(LEGACY_ORDER_ACCESS_TOKEN_KEY)
}

export function consumeOrderAccessTokenFromUrl() {
  const url = new URL(window.location.href)
  const tokenInQuery = url.searchParams.get("access_token")

  if (!tokenInQuery) {
    return ""
  }

  persistOrderAccessToken(tokenInQuery)
  url.searchParams.delete("access_token")

  const nextQuery = url.searchParams.toString()
  const nextUrl = `${url.pathname}${nextQuery ? `?${nextQuery}` : ""}${url.hash}`
  window.history.replaceState({}, "", nextUrl)

  return tokenInQuery.trim()
}
