export type PlisioConfig = {
  apiKey: string
  apiBaseUrl: string
  callbackBaseUrl: string
  successUrl: string
  failUrl: string
  defaultCryptoCurrency: string
  allowedPsysCids: string
  expireMinutes: number | null
  configured: boolean
}

const DEFAULT_API_BASE_URL = "https://api.plisio.net/api/v1"

export function getPlisioConfig(
  env: Record<string, string | undefined> = process.env
): PlisioConfig {
  const apiKey = env.PLISIO_API_KEY?.trim() || ""
  const apiBaseUrl = trimTrailingSlash(
    env.PLISIO_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL
  )
  const callbackBaseUrl = trimTrailingSlash(
    env.PLISIO_CALLBACK_BASE_URL?.trim() || env.API_PUBLIC_URL?.trim() || ""
  )
  const storefrontUrl = trimTrailingSlash(env.STOREFRONT_PUBLIC_URL?.trim() || "")
  const successUrl =
    env.PLISIO_SUCCESS_URL?.trim() ||
    (storefrontUrl ? `${storefrontUrl}/checkout?payment=success` : "")
  const failUrl =
    env.PLISIO_FAIL_URL?.trim() ||
    (storefrontUrl ? `${storefrontUrl}/checkout?payment=failed` : "")

  return {
    apiKey,
    apiBaseUrl,
    callbackBaseUrl,
    successUrl,
    failUrl,
    defaultCryptoCurrency: env.PLISIO_DEFAULT_CRYPTO_CURRENCY?.trim() || "",
    allowedPsysCids: env.PLISIO_ALLOWED_PSYS_CIDS?.trim() || "",
    expireMinutes: parsePositiveInteger(env.PLISIO_EXPIRE_MINUTES),
    configured: Boolean(apiKey && callbackBaseUrl),
  }
}

export function assertPlisioConfigured(config: PlisioConfig) {
  if (!config.apiKey) {
    throw new Error("Plisio payment is not configured. Set PLISIO_API_KEY.")
  }

  if (!config.callbackBaseUrl) {
    throw new Error(
      "Plisio payment is not configured. Set PLISIO_CALLBACK_BASE_URL or API_PUBLIC_URL."
    )
  }
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "")
}

function parsePositiveInteger(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null
  }

  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}
