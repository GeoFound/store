export const medusaBackendUrl =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9002"

export const medusaPublishableKey =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

export const storefrontRegionId =
  process.env.NEXT_PUBLIC_MEDUSA_REGION_ID || ""

export const accountTurnstileEnabled = truthy(
  process.env.NEXT_PUBLIC_ACCOUNT_AUTH_TURNSTILE_ENABLED
)

export const accountTurnstileSiteKey =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""

function truthy(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes((value || "").trim().toLowerCase())
}
