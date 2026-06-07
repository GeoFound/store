import type { SupplierRetrieveInput } from "../../platform/supplier"

export function resolveRetrievePath(input: SupplierRetrieveInput) {
  const metadata = normalizeRecord(input.metadata)

  return (
    text(metadata.supplier_retrieve_path) ||
    text(metadata.reloadly_retrieve_path) ||
    ""
  )
}

export function resolveResultStatus(response: Record<string, unknown>) {
  const status = (
    text(response.status) ||
    text(response.transactionStatus) ||
    text(response.deliveryStatus) ||
    "fulfilled"
  ).toLowerCase()

  if (["failed", "declined", "cancelled", "canceled", "rejected"].includes(status)) {
    return "failed"
  }

  if (["pending", "processing", "queued", "created"].includes(status)) {
    return "pending"
  }

  return "fulfilled"
}

export function resolveProviderOrderId(
  response: Record<string, unknown>,
  input: { providerSku: string; idempotencyKey: string }
) {
  return (
    text(response.transactionId) ||
    text(response.transaction_id) ||
    text(response.orderId) ||
    text(response.order_id) ||
    text(response.id) ||
    input.idempotencyKey
  )
}

export function assertConfigured(configured: boolean) {
  if (!configured) {
    throw new Error(
      "Reloadly supplier is not configured. Set RELOADLY_CLIENT_ID and RELOADLY_CLIENT_SECRET."
    )
  }
}

export function normalizeRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

export function firstArray(...values: unknown[]) {
  for (const value of values) {
    if (Array.isArray(value)) {
      return value
    }
  }

  return []
}

export function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

export function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}
