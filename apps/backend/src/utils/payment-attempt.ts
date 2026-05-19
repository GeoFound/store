import { MedusaError } from "@medusajs/framework/utils"
import { createTokenHint, hashToken } from "./token"

export type InventoryReservationSummary = {
  handler_code?: string
  reservation_key: string
  item_ids: string[]
  metadata?: Record<string, unknown>
}

export type FulfillmentItemSummary = {
  fulfillment_key: string
  cart_item_id?: string | null
  product_variant_id: string
  quantity: number
  inventory_mode: "reserve" | "consume" | "none"
  inventory_handler_code?: string | null
  delivery_handler_code: string
  fulfillment_policy_code?: string | null
  product_type?: string | null
  template_code?: string | null
  reservation_keys?: string[]
  metadata?: Record<string, unknown>
}

export type PaymentAttemptResponsePayload = {
  instructions?: unknown
  inventory_reservations?: InventoryReservationSummary[]
  fulfillment_items?: FulfillmentItemSummary[]
  order_access_claim_token_hash?: string | null
  order_access_claim_token_hint?: string | null
  order_access_claimed_at?: string | null
  order_access_claim_failed_attempts?: number
  order_access_claim_blocked_until?: string | null
  payment_finalized_at?: string | null
  payment_finalization_status?: "processing" | "failed" | "finalized" | null
  payment_finalization_error?: string | null
  marketing_input?: Record<string, unknown>
  marketing_context?: Record<string, unknown>
  [key: string]: unknown
}

export function normalizeAttemptPayload(
  payload: unknown
): PaymentAttemptResponsePayload {
  if (!payload || typeof payload !== "object") {
    return {}
  }

  return payload as PaymentAttemptResponsePayload
}

export function extractInventoryReservations(
  payload: unknown
): InventoryReservationSummary[] {
  const normalized = normalizeAttemptPayload(payload)
  const reservations = normalized.inventory_reservations

  if (!Array.isArray(reservations)) {
    return []
  }

  return reservations.filter(
    (item): item is InventoryReservationSummary =>
      !!item &&
      typeof item === "object" &&
      typeof item.reservation_key === "string" &&
      Array.isArray(item.item_ids) &&
      (!("handler_code" in item) || typeof item.handler_code === "string")
  )
}

export function extractFulfillmentItems(
  payload: unknown
): FulfillmentItemSummary[] {
  const normalized = normalizeAttemptPayload(payload)
  const items = normalized.fulfillment_items

  if (!Array.isArray(items)) {
    return []
  }

  return items.filter(
    (item): item is FulfillmentItemSummary =>
      !!item &&
      typeof item === "object" &&
      typeof item.fulfillment_key === "string" &&
      typeof item.product_variant_id === "string" &&
      typeof item.quantity === "number" &&
      ["reserve", "consume", "none"].includes(String(item.inventory_mode)) &&
      typeof item.delivery_handler_code === "string"
  )
}

export function attachClaimToken(
  payload: unknown,
  claimToken: string
): PaymentAttemptResponsePayload {
  const normalized = normalizeAttemptPayload(payload)

  return {
    ...normalized,
    order_access_claim_token_hash: hashToken(claimToken),
    order_access_claim_token_hint: createTokenHint(claimToken),
    order_access_claimed_at: null,
  }
}

export function assertClaimToken(payload: unknown, claimToken: string) {
  const normalized = normalizeAttemptPayload(payload)

  if (
    !normalized.order_access_claim_token_hash ||
    normalized.order_access_claimed_at
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Order access can no longer be claimed from this payment attempt"
    )
  }

  if (normalized.order_access_claim_token_hash !== hashToken(claimToken)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Invalid order access claim token"
    )
  }
}

export function markClaimTokenConsumed(payload: unknown) {
  const normalized = normalizeAttemptPayload(payload)

  return {
    ...normalized,
    order_access_claim_failed_attempts: 0,
    order_access_claim_blocked_until: null,
    order_access_claimed_at: new Date().toISOString(),
  }
}

export function isPaymentAttemptFinalized(payload: unknown) {
  const normalized = normalizeAttemptPayload(payload)
  return Boolean(normalized.payment_finalized_at)
}

export function markPaymentAttemptFinalized(
  payload: unknown,
  at = new Date()
): PaymentAttemptResponsePayload {
  const normalized = normalizeAttemptPayload(payload)

  return {
    ...normalized,
    payment_finalization_status: "finalized",
    payment_finalization_error: null,
    payment_finalized_at: at.toISOString(),
  }
}

export function markPaymentAttemptFinalizing(
  payload: unknown
): PaymentAttemptResponsePayload {
  const normalized = normalizeAttemptPayload(payload)

  return {
    ...normalized,
    payment_finalization_status: "processing",
    payment_finalization_error: null,
  }
}

export function markPaymentAttemptFinalizationFailed(
  payload: unknown,
  errorMessage: string
): PaymentAttemptResponsePayload {
  const normalized = normalizeAttemptPayload(payload)

  return {
    ...normalized,
    payment_finalization_status: "failed",
    payment_finalization_error: errorMessage,
  }
}

export function isClaimTemporarilyBlocked(payload: unknown, now = new Date()) {
  const normalized = normalizeAttemptPayload(payload)

  if (!normalized.order_access_claim_blocked_until) {
    return false
  }

  return (
    new Date(normalized.order_access_claim_blocked_until).getTime() >
    now.getTime()
  )
}

export function recordFailedClaimAttempt(
  payload: unknown,
  input?: {
    maxAttempts?: number
    blockSeconds?: number
    now?: Date
  }
): PaymentAttemptResponsePayload {
  const normalized = normalizeAttemptPayload(payload)
  const now = input?.now || new Date()
  const maxAttempts = input?.maxAttempts || 8
  const blockSeconds = input?.blockSeconds || 10 * 60
  const failedAttempts = (normalized.order_access_claim_failed_attempts || 0) + 1
  const shouldBlock = failedAttempts >= maxAttempts

  return {
    ...normalized,
    order_access_claim_failed_attempts: failedAttempts,
    order_access_claim_blocked_until: shouldBlock
      ? new Date(now.getTime() + blockSeconds * 1000).toISOString()
      : normalized.order_access_claim_blocked_until || null,
  }
}
