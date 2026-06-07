import { MedusaError } from "@medusajs/framework/utils"
import { getOrderAccessProvider } from "../platform/order-access"
import { normalizeAttemptPayload } from "../utils/payment-attempt"

const DEFAULT_ORDER_ACCESS_PROVIDER_CODE = "guest-order-access"

export function resolveConfiguredOrderAccessProviderCode(
  env: Record<string, string | undefined> = process.env
) {
  return (
    normalizeString(env.ORDER_ACCESS_PROVIDER_CODE) ||
    DEFAULT_ORDER_ACCESS_PROVIDER_CODE
  )
}

export function requireAttemptOrderAccessProviderCode(
  payload: unknown
) {
  const normalized = normalizeAttemptPayload(payload)
  const code = normalizeString(normalized.order_access_provider_code)

  if (!code) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Payment attempt is missing order_access_provider_code and cannot issue order access safely"
    )
  }

  return code
}

export function resolveOrderAccessProviderOrThrow(code: string) {
  const provider = getOrderAccessProvider(code)

  if (!provider) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Order access provider ${code} is not registered`
    )
  }

  return provider
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}
