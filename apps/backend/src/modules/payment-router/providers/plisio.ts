import crypto from "crypto"
import type {
  CreateProviderPaymentInput,
  CreateProviderPaymentResult,
  PaymentProvider,
  PaymentWebhookContext,
  PaymentWebhookResult,
} from "./types"
import {
  assertPlisioConfigured,
  getPlisioConfig,
  type PlisioConfig,
} from "./plisio-config"

export class PlisioPaymentProvider implements PaymentProvider {
  code = "plisio"

  isConfigured() {
    return getPlisioConfig().configured
  }

  async createPayment(
    input: CreateProviderPaymentInput
  ): Promise<CreateProviderPaymentResult> {
    const config = getPlisioConfig()
    assertPlisioConfigured(config)

    const orderNumber = createOrderNumber(input.cartId)
    const requestParams = buildInvoiceParams(input, config, orderNumber)
    const requestUrl = new URL(`${config.apiBaseUrl}/invoices/new`)

    for (const [key, value] of Object.entries(requestParams)) {
      if (value !== "") {
        requestUrl.searchParams.set(key, value)
      }
    }

    const response = await fetch(requestUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    })
    const responseBody = await parseJsonResponse(response)

    if (responseBody.status !== "success") {
      throw new Error(
        `Plisio invoice creation failed: ${extractPlisioErrorMessage(
          responseBody
        )}`
      )
    }

    const data = normalizeRecord(responseBody.data)
    const providerOrderId = text(data.txn_id) || text(data.id)
    const paymentUrl = text(data.invoice_url)

    if (!providerOrderId) {
      throw new Error("Plisio invoice response did not include txn_id")
    }

    if (!paymentUrl) {
      throw new Error("Plisio invoice response did not include invoice_url")
    }

    return {
      providerOrderId,
      paymentUrl,
      qrCodeUrl: text(data.qr_code) || null,
      expiresAt: parseUnixTimestamp(data.expire_utc),
      responsePayload: {
        provider: "plisio",
        order_number: orderNumber,
        invoice_url: paymentUrl,
        txn_id: providerOrderId,
        source_currency: requestParams.source_currency,
        source_amount: requestParams.source_amount,
        currency: text(data.currency) || requestParams.currency || null,
        allowed_psys_cids: requestParams.allowed_psys_cids || null,
        raw: data,
      },
      instructions: undefined,
    }
  }

  parseWebhook(
    payload: Record<string, unknown>,
    context?: PaymentWebhookContext
  ): PaymentWebhookResult {
    const config = getPlisioConfig()
    assertPlisioConfigured(config)
    const webhookPayload = resolveWebhookPayload(payload, context)
    assertPlisioWebhookSignature(webhookPayload, config.apiKey)

    const providerOrderId =
      text(webhookPayload.switch_id) || text(webhookPayload.txn_id)

    if (!providerOrderId) {
      throw new Error("Plisio webhook is missing txn_id")
    }

    return {
      providerOrderId,
      status: mapPlisioWebhookStatus(text(webhookPayload.status)),
      payload: webhookPayload,
    }
  }
}

export const plisioPaymentProvider = new PlisioPaymentProvider()

export function buildPlisioCallbackUrl(callbackBaseUrl: string) {
  const url = new URL("hooks/payment/plisio", `${callbackBaseUrl}/`)
  url.searchParams.set("json", "true")
  return url.toString()
}

export function formatMinorAmountForPlisio(amount: number, currency: string) {
  const decimals = currencyMinorUnit(currency)
  const divisor = 10 ** decimals
  const major = amount / divisor

  if (!decimals) {
    return String(Math.trunc(major))
  }

  return major
    .toFixed(decimals)
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "")
}

export function assertPlisioWebhookSignature(
  payload: Record<string, unknown>,
  apiKey: string
) {
  const verifyHash = text(payload.verify_hash)

  if (!verifyHash) {
    throw new Error("Plisio webhook is missing verify_hash")
  }

  const signedPayload = {
    ...payload,
  }
  delete signedPayload.verify_hash

  const candidates = [
    JSON.stringify(signedPayload),
    JSON.stringify(sortRecordByKey(signedPayload)),
  ]
  const valid = candidates.some((candidate) =>
    timingSafeEqualHex(hmacSha1(candidate, apiKey), verifyHash)
  )

  if (!valid) {
    throw new Error("Invalid Plisio webhook signature")
  }
}

export function mapPlisioWebhookStatus(status: string) {
  const normalized = status.toLowerCase()

  if (normalized === "completed") {
    return "paid"
  }

  if (
    normalized === "expired" ||
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized === "cancelled duplicate" ||
    normalized === "canceled duplicate"
  ) {
    return "expired"
  }

  if (normalized === "error" || normalized === "failed") {
    return "failed"
  }

  if (
    normalized === "new" ||
    normalized === "pending" ||
    normalized === "pending internal"
  ) {
    return "pending"
  }

  throw new Error(`Unsupported Plisio webhook status: ${status || "unknown"}`)
}

function buildInvoiceParams(
  input: CreateProviderPaymentInput,
  config: PlisioConfig,
  orderNumber: string
) {
  const channelConfig = normalizeRecord(input.channelConfig)
  const sourceCurrency = input.currency.toUpperCase()
  const cryptoCurrency =
    text(channelConfig.crypto_currency) ||
    text(channelConfig.currency) ||
    config.defaultCryptoCurrency
  const allowedPsysCids =
    text(channelConfig.allowed_psys_cids) || config.allowedPsysCids
  const expireMinutes =
    numberOrNull(channelConfig.expire_min) || config.expireMinutes

  return {
    source_currency: sourceCurrency,
    source_amount: formatMinorAmountForPlisio(input.amount, input.currency),
    order_number: orderNumber,
    order_name: `cart-${input.cartId}`,
    description: `Digital goods cart ${input.cartId}`,
    callback_url: buildPlisioCallbackUrl(config.callbackBaseUrl),
    success_invoice_url: config.successUrl,
    fail_invoice_url: config.failUrl,
    email: input.customerEmail || "",
    currency: cryptoCurrency,
    allowed_psys_cids: allowedPsysCids,
    expire_min: expireMinutes ? String(expireMinutes) : "",
    plugin: "dtc-store",
    version: "1",
    api_key: config.apiKey,
  }
}

function createOrderNumber(cartId: string) {
  const suffix = crypto.randomBytes(4).toString("hex")
  return `${cartId}_${Date.now()}_${suffix}`
}

async function parseJsonResponse(response: Response) {
  const textBody = await response.text()
  let body: unknown = {}

  if (textBody.trim()) {
    try {
      body = JSON.parse(textBody)
    } catch {
      body = {
        status: "error",
        data: {
          message: textBody,
        },
      }
    }
  }

  if (!response.ok) {
    throw new Error(
      `Plisio request failed with status ${response.status}: ${textBody.slice(
        0,
        500
      )}`
    )
  }

  return normalizeRecord(body)
}

function extractPlisioErrorMessage(body: Record<string, unknown>) {
  const data = normalizeRecord(body.data)
  return text(data.message) || text(data.name) || text(body.status) || "unknown"
}

function resolveWebhookPayload(
  payload: Record<string, unknown>,
  context?: PaymentWebhookContext
) {
  const rawBody =
    typeof context?.rawBody === "string"
      ? context.rawBody
      : Buffer.isBuffer(context?.rawBody)
        ? context.rawBody.toString("utf8")
        : ""

  if (rawBody.trim().startsWith("{")) {
    try {
      return normalizeRecord(JSON.parse(rawBody))
    } catch {
      throw new Error("Plisio webhook raw body is not valid JSON")
    }
  }

  return payload
}

function parseUnixTimestamp(value: unknown) {
  const timestamp = numberOrNull(value)

  if (!timestamp) {
    return null
  }

  const date = new Date(timestamp * 1000)

  return Number.isFinite(date.getTime()) ? date : null
}

function currencyMinorUnit(currency: string) {
  const code = currency.trim().toUpperCase()

  if (ZERO_DECIMAL_CURRENCIES.has(code)) {
    return 0
  }

  if (THREE_DECIMAL_CURRENCIES.has(code)) {
    return 3
  }

  return 2
}

const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "ISK",
  "JPY",
  "KMF",
  "KRW",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
])

const THREE_DECIMAL_CURRENCIES = new Set([
  "BHD",
  "IQD",
  "JOD",
  "KWD",
  "LYD",
  "OMR",
  "TND",
])

function sortRecordByKey(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortRecordByKey(item))
  }

  if (!value || typeof value !== "object") {
    return value
  }

  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = sortRecordByKey((value as Record<string, unknown>)[key])
      return acc
    }, {})
}

function hmacSha1(value: string, apiKey: string) {
  return crypto.createHmac("sha1", apiKey).update(value).digest("hex")
}

function timingSafeEqualHex(left: string, right: string) {
  if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) {
    return false
  }

  const leftBuffer = Buffer.from(left, "hex")
  const rightBuffer = Buffer.from(right, "hex")

  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  )
}

function normalizeRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}
