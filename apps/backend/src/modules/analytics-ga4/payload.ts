const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
])

export type Ga4EventPayload = {
  name: string
  client_id?: string
  user_id?: string
  params: Record<string, unknown>
}

export function buildGa4PurchasePayload(input: {
  orderId: string
  attempt: Record<string, unknown>
}) {
  const attempt = normalizeRecord(input.attempt)
  const requestPayload = normalizeRecord(attempt.request_payload)
  const responsePayload = normalizeRecord(attempt.response_payload)
  const metadata = normalizeRecord(requestPayload.metadata)
  const analyticsContext = normalizeRecord(metadata.analytics_context)
  const marketingContext = normalizeRecord(responsePayload.marketing_context)
  const currency = normalizeCurrency(toOptionalText(attempt.currency) || "USD")
  const amountMinor = toNumber(attempt.amount)

  const couponRecord = normalizeRecord(marketingContext.coupon)
  const referralRecord = normalizeRecord(marketingContext.referral)
  const attributionRecord = normalizeRecord(marketingContext.attribution)

  const items = buildPurchaseItems(responsePayload)

  return {
    name: "purchase",
    client_id: toOptionalText(analyticsContext.ga_client_id) || undefined,
    params: {
      transaction_id: input.orderId,
      payment_attempt_id: toOptionalText(attempt.id) || undefined,
      payment_provider: toOptionalText(attempt.provider_code) || undefined,
      currency,
      value: minorToDecimal(amountMinor, currency),
      coupon: toOptionalText(couponRecord.code) || undefined,
      referral_code: toOptionalText(referralRecord.code) || undefined,
      traffic_source: toOptionalText(attributionRecord.source) || undefined,
      traffic_medium: toOptionalText(attributionRecord.medium) || undefined,
      traffic_campaign: toOptionalText(attributionRecord.campaign) || undefined,
      items,
    },
  } satisfies Ga4EventPayload
}

export function buildGa4OrderAccessPayload(input: {
  eventName: "order_access_claimed" | "order_recovery_verified" | "order_recovery_code_sent"
  orderId: string
  payload: Record<string, unknown>
}) {
  const metadata = normalizeRecord(input.payload.metadata)
  const analyticsContext = normalizeRecord(metadata.analytics_context)

  return {
    name: input.eventName,
    client_id: toOptionalText(analyticsContext.ga_client_id) || undefined,
    params: {
      order_id: input.orderId,
      source: toOptionalText(input.payload.source) || undefined,
      purpose: toOptionalText(input.payload.purpose) || undefined,
    },
  } satisfies Ga4EventPayload
}

export function buildGa4MeasurementProtocolPayload(input: {
  event: Record<string, unknown>
  fallbackClientId: string
}) {
  const event = normalizeRecord(input.event)
  const payload = normalizeRecord(event.payload_json)
  const params = normalizeRecord(payload.params)
  const name = toOptionalText(payload.name) || toOptionalText(event.event_name) || "custom_event"
  const clientId =
    toOptionalText(payload.client_id) ||
    toOptionalText(normalizeRecord(event.metadata_json).ga_client_id) ||
    input.fallbackClientId

  const body: Record<string, unknown> = {
    client_id: clientId,
    events: [
      {
        name,
        params,
      },
    ],
  }

  if (typeof event.customer_email_hash === "string" && event.customer_email_hash.trim()) {
    body.user_id = event.customer_email_hash.trim()
  }

  return body
}

export function createFallbackClientId(event: Record<string, unknown>) {
  const record = normalizeRecord(event)
  const eventId = toOptionalText(record.id) || "event"

  return `store.${eventId}`
}

export function minorToDecimal(amountMinor: number, currency: string) {
  const safeMinor = Number.isFinite(amountMinor) ? amountMinor : 0
  const normalizedCurrency = normalizeCurrency(currency)

  if (ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency)) {
    return safeMinor
  }

  return Number((safeMinor / 100).toFixed(2))
}

function buildPurchaseItems(responsePayload: Record<string, unknown>) {
  const reservations = Array.isArray(responsePayload.inventory_reservations)
    ? responsePayload.inventory_reservations
    : []

  const byVariantId = new Map<
    string,
    {
      quantity: number
      item_name: string
    }
  >()

  for (const reservationValue of reservations) {
    const reservation = normalizeRecord(reservationValue)
    const metadata = normalizeRecord(reservation.metadata)
    const variantId =
      toOptionalText(metadata.product_variant_id) ||
      toOptionalText(metadata.variant_id) ||
      "unknown_variant"
    const quantity = Array.isArray(reservation.item_ids)
      ? reservation.item_ids.length
      : Math.max(1, toNumber(reservation.quantity))

    const existing = byVariantId.get(variantId) || {
      quantity: 0,
      item_name: variantId,
    }

    existing.quantity += quantity
    byVariantId.set(variantId, existing)
  }

  if (!byVariantId.size) {
    return [
      {
        item_id: "unknown_variant",
        item_name: "Unknown digital product",
        quantity: 1,
      },
    ]
  }

  return Array.from(byVariantId.entries()).map(([variantId, summary]) => ({
    item_id: variantId,
    item_name: summary.item_name,
    quantity: summary.quantity,
  }))
}

function toOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)

    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return 0
}

function normalizeCurrency(value: string) {
  return value.trim().toUpperCase() || "USD"
}

function normalizeRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}
