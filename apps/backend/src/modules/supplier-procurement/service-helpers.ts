import { MedusaError } from "@medusajs/framework/utils"

type SupplierProcurementOrderRecord = Record<string, any>

export function buildDefaultSupplierDeliveryPayload(
  order: SupplierProcurementOrderRecord,
  result: { status: string; providerOrderId?: string | null; message?: string | null }
) {
  return {
    status: result.status,
    message: result.message || "Supplier procurement completed.",
    supplier_procurement_order_id: order.id,
    supplier_provider: order.provider_code,
    supplier_provider_order_id:
      toNullableText(result.providerOrderId) || order.provider_order_id || null,
  }
}

export function normalizeLimit(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback
  }

  return Math.max(1, Math.min(Math.floor(value), 500))
}

export function normalizeQuantity(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.floor(value))
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 0
  }

  return 0
}

export function normalizeOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

export function normalizeDate(value: unknown) {
  if (value instanceof Date) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value)
    return Number.isFinite(parsed.getTime()) ? parsed : null
  }

  return null
}

export function normalizeCurrencyCode(value: unknown) {
  if (typeof value !== "string") {
    return ""
  }

  const normalized = value.trim().toLowerCase()

  return /^[a-z]{3}$/.test(normalized) ? normalized : ""
}

export function normalizeRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

export function toOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

export function toNullableText(value: unknown) {
  return toOptionalText(value) || null
}

export function requireText(value: unknown, field: string) {
  const normalized = toOptionalText(value)

  if (!normalized) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `${field} is required`
    )
  }

  return normalized
}

export function redactSensitiveRecord(value: Record<string, unknown>) {
  const redacted: Record<string, unknown> = {}

  for (const [key, entry] of Object.entries(value)) {
    if (isSensitiveKey(key)) {
      redacted[key] = "[redacted]"
      continue
    }

    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      redacted[key] = redactSensitiveRecord(entry as Record<string, unknown>)
      continue
    }

    if (Array.isArray(entry)) {
      redacted[key] = entry.map((item) =>
        item && typeof item === "object"
          ? redactSensitiveRecord(item as Record<string, unknown>)
          : item
      )
      continue
    }

    redacted[key] = entry
  }

  return redacted
}

function isSensitiveKey(key: string) {
  return /secret|token|password|pin|code|key|credential|card_number|cardnumber/i.test(
    key
  )
}
