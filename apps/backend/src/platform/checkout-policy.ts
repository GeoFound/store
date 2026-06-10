export type CheckoutOutOfStockPolicy = "block" | "allow_supplier_backorder"

export type CheckoutPolicy = {
  outOfStockPolicy: CheckoutOutOfStockPolicy
  supplierAutoProcurementEnabled: boolean
}

export function getCheckoutPolicy(
  env: Record<string, string | undefined> = process.env
): CheckoutPolicy {
  return {
    outOfStockPolicy: parseOutOfStockPolicy(
      env.CHECKOUT_OUT_OF_STOCK_POLICY
    ),
    supplierAutoProcurementEnabled: parseBoolean(
      env.SUPPLIER_AUTO_PROCUREMENT_ENABLED,
      false
    ),
  }
}

export function parseOutOfStockPolicy(
  value: string | undefined
): CheckoutOutOfStockPolicy {
  const normalized = normalizeText(value)

  if (!normalized || normalized === "block") {
    return "block"
  }

  if (
    normalized === "allow_supplier_backorder" ||
    normalized === "supplier_backorder" ||
    normalized === "allow"
  ) {
    return "allow_supplier_backorder"
  }

  throw new Error(
    "CHECKOUT_OUT_OF_STOCK_POLICY must be one of: block, allow_supplier_backorder"
  )
}

export function isSupplierAutoProcurementEnabled(
  env: Record<string, string | undefined> = process.env
) {
  return parseBoolean(env.SUPPLIER_AUTO_PROCUREMENT_ENABLED, false)
}

export function hasSupplierMetadataPath(
  metadata?: Record<string, unknown> | null
) {
  return Boolean(
    (toOptionalText(metadata?.supplier_provider) ||
      toOptionalText(metadata?.supplierProvider) ||
      toOptionalText(metadata?.provider_code) ||
      toOptionalText(metadata?.providerCode)) &&
      (toOptionalText(metadata?.supplier_sku) ||
        toOptionalText(metadata?.supplierSku) ||
        toOptionalText(metadata?.provider_sku) ||
        toOptionalText(metadata?.providerSku))
  )
}

export function isOutOfStockReservationError(error: unknown) {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error || "")

  return (
    message.includes("not enough") ||
    message.includes("out of stock") ||
    message.includes("insufficient")
  )
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback
  }

  return ["1", "true", "yes", "on"].includes(normalizeText(value))
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

function toOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}
