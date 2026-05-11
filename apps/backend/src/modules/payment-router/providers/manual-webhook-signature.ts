import crypto from "crypto"
import { MedusaError } from "@medusajs/framework/utils"
import type { PaymentWebhookContext } from "./types"

const DEFAULT_TIMESTAMP_TOLERANCE_SECONDS = 5 * 60

export function assertManualWebhookSignature(
  payload: Record<string, unknown>,
  context?: PaymentWebhookContext
) {
  const secret = process.env.MANUAL_WEBHOOK_SECRET

  if (!secret) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "MANUAL_WEBHOOK_SECRET is not configured"
    )
  }

  const timestamp = getHeader(context, "x-manual-webhook-timestamp")
  const signature = getHeader(context, "x-manual-webhook-signature")

  if (!timestamp || !signature) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Missing manual webhook signature headers"
    )
  }

  const timestampSeconds = Number(timestamp)
  if (!Number.isFinite(timestampSeconds)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Invalid manual webhook timestamp header"
    )
  }

  const toleranceSeconds = resolveToleranceSeconds()
  const nowSeconds = Math.floor(Date.now() / 1000)

  if (Math.abs(nowSeconds - timestampSeconds) > toleranceSeconds) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Manual webhook signature has expired"
    )
  }

  const message = `${timestamp}.${resolveRawBody(payload, context)}`
  const expected = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex")
  const normalizedSignature = signature.startsWith("sha256=")
    ? signature.slice("sha256=".length)
    : signature

  if (!timingSafeEqual(expected, normalizedSignature)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Invalid manual webhook signature"
    )
  }
}

function resolveToleranceSeconds() {
  const value = Number(process.env.MANUAL_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS)

  if (Number.isFinite(value) && value >= 30) {
    return Math.floor(value)
  }

  return DEFAULT_TIMESTAMP_TOLERANCE_SECONDS
}

function getHeader(
  context: PaymentWebhookContext | undefined,
  name: string
): string {
  if (!context?.headers) {
    return ""
  }

  const directValue = context.headers[name]
  const normalizedValue = context.headers[name.toLowerCase()]
  const candidate = directValue ?? normalizedValue

  if (Array.isArray(candidate)) {
    return (candidate[0] || "").trim()
  }

  return typeof candidate === "string" ? candidate.trim() : ""
}

function resolveRawBody(
  payload: Record<string, unknown>,
  context?: PaymentWebhookContext
) {
  if (typeof context?.rawBody === "string") {
    return context.rawBody
  }

  if (Buffer.isBuffer(context?.rawBody)) {
    return context.rawBody.toString("utf8")
  }

  return JSON.stringify(payload)
}

function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)

  if (left.length !== right.length) {
    return false
  }

  return crypto.timingSafeEqual(left, right)
}
