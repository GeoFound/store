import crypto from "crypto"

export const STORE_GRAPH_PRODUCT_ID = "store_digital_goods"

export const STORE_GRAPH_SUPPORTED_EVENT_NAMES = [
  "view_item",
  "add_to_cart",
  "view_cart",
  "begin_checkout",
  "purchase",
  "order_access_claimed",
] as const

export type StoreGraphSupportedEventName =
  (typeof STORE_GRAPH_SUPPORTED_EVENT_NAMES)[number]

export type GraphJsonValue =
  | string
  | number
  | boolean
  | null
  | GraphJsonValue[]
  | { [key: string]: GraphJsonValue }

export type GraphJsonObject = { [key: string]: GraphJsonValue }

export type GraphRawSourceEventRecord = {
  record_id: string
  tenant_id: string
  product_id: string
  source_event_name: StoreGraphSupportedEventName | string
  occurred_at: string
  received_at: string
  source: string
  trace_id: string
  idempotency_key: string
  session_id: string
  channel: string
  platform: string
  country: string
  language: string
  identity: Record<string, string>
  properties: GraphJsonObject
  processing_purpose: string[]
  data_source_type: string
  data_classification: string
}

export type StoreAnalyticsEventForGraph = {
  id: string
  event_name: string
  source?: string | null
  event_key?: string | null
  occurred_at: string | Date
  created_at?: string | Date | null
  updated_at?: string | Date | null
  cart_id?: string | null
  order_id?: string | null
  payment_attempt_id?: string | null
  customer_email_hash?: string | null
  payload_json?: Record<string, unknown> | null
  metadata_json?: Record<string, unknown> | null
}

export type StoreGraphExportOptions = {
  tenantId?: string
  productId?: string
  source?: string
  defaultCountry?: string
  defaultLanguage?: string
  defaultChannel?: string
  defaultPlatform?: string
}

const SUPPORTED_EVENT_NAMES = new Set<string>(STORE_GRAPH_SUPPORTED_EVENT_NAMES)
const RAW_PII_KEYS = new Set([
  "email",
  "phone",
  "name",
  "customer_email",
  "customer_phone",
  "customer_name",
])

export function exportAnalyticsEventsToGraphRawSourceEvents(
  events: StoreAnalyticsEventForGraph[],
  options: StoreGraphExportOptions = {}
): GraphRawSourceEventRecord[] {
  return events
    .map((event) => exportAnalyticsEventToGraphRawSourceEvent(event, options))
    .filter((event): event is GraphRawSourceEventRecord => event !== null)
}

export function exportAnalyticsEventToGraphRawSourceEvent(
  event: StoreAnalyticsEventForGraph,
  options: StoreGraphExportOptions = {}
): GraphRawSourceEventRecord | null {
  const eventName = normalizeText(event.event_name)

  if (!SUPPORTED_EVENT_NAMES.has(eventName)) {
    return null
  }

  const payload = normalizeRecord(event.payload_json)
  const params = normalizeParams(payload)
  const metadata = normalizeRecord(event.metadata_json)
  const sourceEventId = normalizeText(event.id)
  const eventSeed = event.event_key || sourceEventId
  const receivedAt = toIsoTimestamp(
    event.created_at || event.updated_at || event.occurred_at
  )
  const traceSeed = stableDigest([eventName, eventSeed, sourceEventId])
  const identity = buildIdentity(event, payload, params, metadata)
  const properties = buildProperties(event, params, metadata)

  return {
    record_id: `store-analytics-${sourceEventId}`,
    tenant_id: options.tenantId || "tenant-store-local",
    product_id: options.productId || STORE_GRAPH_PRODUCT_ID,
    source_event_name: eventName,
    occurred_at: toIsoTimestamp(event.occurred_at),
    received_at: receivedAt,
    source: options.source || "store_analytics_event",
    trace_id: buildTraceId(metadata, payload, traceSeed),
    idempotency_key: `store-analytics-${stableDigest([eventName, eventSeed])}`,
    session_id: buildSessionId(metadata, params, traceSeed),
    channel:
      safeToken(metadata.channel) ||
      safeToken(params.channel) ||
      options.defaultChannel ||
      defaultChannel(event.source),
    platform:
      safeToken(metadata.platform) ||
      safeToken(params.platform) ||
      options.defaultPlatform ||
      "web",
    country:
      safeToken(metadata.country) ||
      safeToken(params.country) ||
      options.defaultCountry ||
      "ZZ",
    language:
      safeToken(metadata.language) ||
      safeToken(params.language) ||
      options.defaultLanguage ||
      "und",
    identity,
    properties,
    processing_purpose: processingPurposeForEvent(eventName),
    data_source_type: "first_party",
    data_classification: classifyData(identity, properties),
  }
}

function buildIdentity(
  event: StoreAnalyticsEventForGraph,
  payload: Record<string, unknown>,
  params: Record<string, unknown>,
  metadata: Record<string, unknown>
) {
  const identity: Record<string, string> = {}
  const emailHash =
    sha256Text(event.customer_email_hash) ||
    sha256Text(metadata.email_hash) ||
    sha256Text(params.email_hash)

  if (emailHash) {
    identity.email_hash = emailHash
  }

  const anonymousId =
    safeToken(metadata.anonymous_id) ||
    safeToken(params.anonymous_id) ||
    safeToken(payload.client_id) ||
    safeToken(metadata.ga_client_id)

  if (anonymousId) {
    identity.anonymous_id = anonymousId
  }

  const accountIdHash =
    sha256Text(metadata.account_id_hash) || sha256Text(params.account_id_hash)

  if (accountIdHash) {
    identity.account_id_hash = accountIdHash
  }

  return identity
}

function buildProperties(
  event: StoreAnalyticsEventForGraph,
  params: Record<string, unknown>,
  metadata: Record<string, unknown>
): GraphJsonObject {
  const item = firstItem(params)
  const properties: GraphJsonObject = {}

  addProperty(
    properties,
    "product_id",
    safeToken(params.product_id) || safeToken(item.product_id)
  )
  addProperty(
    properties,
    "variant_id",
    safeToken(params.variant_id) ||
      safeToken(params.item_id) ||
      safeToken(item.variant_id) ||
      safeToken(item.item_id)
  )
  addProperty(properties, "cart_id", safeToken(event.cart_id) || safeToken(params.cart_id))
  addProperty(
    properties,
    "order_id",
    safeToken(event.order_id) ||
      safeToken(params.order_id) ||
      safeToken(params.transaction_id)
  )
  addProperty(
    properties,
    "payment_attempt_id",
    safeToken(event.payment_attempt_id) || safeToken(params.payment_attempt_id)
  )
  addProperty(properties, "currency", safeToken(params.currency))
  addProperty(properties, "amount", finiteNumber(params.amount) ?? finiteNumber(params.value))
  addProperty(
    properties,
    "quantity",
    finiteNumber(params.quantity) ?? finiteNumber(item.quantity)
  )
  addProperty(
    properties,
    "page_path",
    safePath(metadata.page_path) || safePath(params.page_path)
  )
  addProperty(properties, "source_event_id", safeToken(event.id))

  return properties
}

function normalizeParams(payload: Record<string, unknown>) {
  const params = normalizeRecord(payload.params)

  return {
    ...payload,
    ...params,
  }
}

function firstItem(params: Record<string, unknown>) {
  const items = Array.isArray(params.items) ? params.items : []

  return normalizeRecord(items[0])
}

function addProperty(
  properties: GraphJsonObject,
  key: string,
  value: string | number | boolean | null | undefined
) {
  if (typeof value === "undefined" || value === null || value === "") {
    return
  }

  properties[key] = value
}

function buildTraceId(
  metadata: Record<string, unknown>,
  payload: Record<string, unknown>,
  traceSeed: string
) {
  return (
    safeToken(metadata.trace_id) ||
    safeToken(payload.trace_id) ||
    `trace-store-${traceSeed}`
  )
}

function buildSessionId(
  metadata: Record<string, unknown>,
  params: Record<string, unknown>,
  traceSeed: string
) {
  return (
    safeToken(metadata.session_id) ||
    safeToken(params.session_id) ||
    safeToken(metadata.ga_session_id) ||
    safeToken(params.ga_session_id) ||
    `session-store-${traceSeed}`
  )
}

function processingPurposeForEvent(eventName: string) {
  if (eventName === "purchase" || eventName === "order_access_claimed") {
    return ["analytics", "operations"]
  }

  return ["analytics"]
}

function classifyData(
  identity: Record<string, string>,
  properties: GraphJsonObject
) {
  const hasPseudonymousIdentity = Object.keys(identity).length > 0
  const hasPseudonymousProperties = [
    "cart_id",
    "order_id",
    "payment_attempt_id",
    "source_event_id",
  ].some((key) => typeof properties[key] === "string")

  return hasPseudonymousIdentity || hasPseudonymousProperties
    ? "pseudonymous"
    : "non_pii"
}

function defaultChannel(source: unknown) {
  return normalizeText(source) === "backend_hook" ? "backend" : "storefront"
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function safeToken(value: unknown) {
  const text = normalizeText(value)

  if (!text || containsRawPii(text)) {
    return ""
  }

  return text
}

function safePath(value: unknown) {
  const text = safeToken(value)

  if (!text || /^https?:\/\//i.test(text)) {
    return ""
  }

  return text
}

function sha256Text(value: unknown) {
  const text = normalizeText(value)

  return /^[a-f0-9]{64}$/i.test(text) ? text.toLowerCase() : ""
}

function containsRawPii(value: string) {
  if (value.includes("@")) {
    return true
  }

  return /\+?[0-9][0-9 .()-]{7,}[0-9]/.test(value)
}

function finiteNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null
  }

  return value
}

function toIsoTimestamp(value: string | Date | null | undefined) {
  const date = value instanceof Date ? value : new Date(value || "")

  if (Number.isNaN(date.getTime())) {
    return new Date(0).toISOString()
  }

  return date.toISOString()
}

function stableDigest(values: Array<string | null | undefined>) {
  return crypto
    .createHash("sha256")
    .update(values.filter(Boolean).join("|"))
    .digest("hex")
    .slice(0, 20)
}

export function hasRawPiiKey(input: unknown): boolean {
  if (Array.isArray(input)) {
    return input.some((item) => hasRawPiiKey(item))
  }

  if (!input || typeof input !== "object") {
    return false
  }

  return Object.entries(input as Record<string, unknown>).some(([key, value]) => {
    if (RAW_PII_KEYS.has(key.toLowerCase())) {
      return true
    }

    return hasRawPiiKey(value)
  })
}
