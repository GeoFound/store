export type CustomerAccountMode = "guest_optional" | "guest_only"

type Env = Record<string, string | undefined>

export function resolveCustomerAccountMode(
  env: Env = process.env
): CustomerAccountMode {
  const value = normalized(env.CUSTOMER_ACCOUNT_MODE)

  if (["guest_only", "disabled", "off"].includes(value)) {
    return "guest_only"
  }

  return "guest_optional"
}

export function isCustomerAccountEnabled(env: Env = process.env) {
  return resolveCustomerAccountMode(env) === "guest_optional"
}

export function isCustomerPasswordResetEnabled(env: Env = process.env) {
  if (!isCustomerAccountEnabled(env)) {
    return false
  }

  return !["0", "false", "no", "off"].includes(
    normalized(env.CUSTOMER_PASSWORD_RESET_ENABLED)
  )
}

export function resolveCustomerPasswordResetUrl(input: {
  requestUrl?: string
  env?: Env
}) {
  const env = input.env || process.env
  const configured = trimTrailingSlash(env.CUSTOMER_PASSWORD_RESET_URL || "")

  if (configured) {
    return configured
  }

  const storefrontOrigin =
    trimTrailingSlash(env.STOREFRONT_PUBLIC_URL || "") ||
    (input.requestUrl ? new URL(input.requestUrl).origin : "")

  return storefrontOrigin
    ? `${storefrontOrigin}/account/reset-password`
    : "/account/reset-password"
}

export function resolveCustomerEmailVerificationStrategy(
  env: Env = process.env
) {
  const value = normalized(env.CUSTOMER_EMAIL_VERIFICATION_STRATEGY)

  return value || "recovery_only"
}

function normalized(value: string | undefined) {
  return (value || "").trim().toLowerCase()
}

function trimTrailingSlash(value: string) {
  return value.trim().replace(/\/+$/, "")
}
