export type ReloadlyConfig = {
  clientId: string
  clientSecret: string
  authUrl: string
  audience: string
  giftcardsBaseUrl: string
  airtimeBaseUrl: string
  senderName: string
  configured: boolean
}

export function getReloadlyConfig(
  env: Record<string, string | undefined> = process.env
): ReloadlyConfig {
  const environment = (env.RELOADLY_ENV || "sandbox").trim().toLowerCase()
  const giftcardsBaseUrl =
    env.RELOADLY_GIFTCARDS_BASE_URL ||
    env.RELOADLY_API_BASE_URL ||
    (environment === "production"
      ? "https://giftcards.reloadly.com"
      : "https://giftcards-sandbox.reloadly.com")
  const airtimeBaseUrl =
    env.RELOADLY_AIRTIME_BASE_URL ||
    (environment === "production"
      ? "https://topups.reloadly.com"
      : "https://topups-sandbox.reloadly.com")

  return {
    clientId: env.RELOADLY_CLIENT_ID?.trim() || "",
    clientSecret: env.RELOADLY_CLIENT_SECRET?.trim() || "",
    authUrl:
      env.RELOADLY_AUTH_URL?.trim() || "https://auth.reloadly.com/oauth/token",
    audience: env.RELOADLY_AUDIENCE?.trim() || giftcardsBaseUrl,
    giftcardsBaseUrl: trimTrailingSlash(giftcardsBaseUrl),
    airtimeBaseUrl: trimTrailingSlash(airtimeBaseUrl),
    senderName: env.RELOADLY_SENDER_NAME?.trim() || "Store",
    configured: Boolean(
      env.RELOADLY_CLIENT_ID?.trim() && env.RELOADLY_CLIENT_SECRET?.trim()
    ),
  }
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "")
}
