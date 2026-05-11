import type { MedusaContainer } from "@medusajs/framework/types"
import type { PaymentAttemptFinalizedEvent } from "../../platform/events"
import { PLATFORM_HOOKS } from "../../platform/hooks"
import {
  emitMarketingAttemptClosed,
  emitMarketingAttemptPaid,
  type MarketingResolvedContext,
} from "../../platform/marketing"
import { getPlatformRuntime, registerPlatformHook } from "../../platform/runtime"
import { MARKETING_ENGINE_MODULE } from "."
import type MarketingEngineModuleService from "./service"
import { ensureMarketingStrategiesRegistered } from "./strategies/default"

let hooksRegistered = false

export function ensureMarketingHooksRegistered() {
  ensureMarketingStrategiesRegistered()

  if (hooksRegistered) {
    return
  }

  registerPlatformHook<PaymentAttemptFinalizedEvent>({
    hook: PLATFORM_HOOKS.paymentAttemptFinalized,
    pluginId: "marketing-engine",
    name: "marketing-engine.payment-attempt-finalized",
    version: "v1",
    enabled: true,
    handler: async (event) => {
      if (!getPlatformRuntime().isPluginEnabled("marketing-engine")) {
        return
      }

      const context = extractMarketingContext(event.payload.attempt)
      const customerEmail = extractCustomerEmail(event.payload.attempt)

      await emitMarketingAttemptPaid({
        scope: event.scope,
        attemptId: String(event.payload.attempt.id),
        orderId: event.payload.orderId,
        customerEmail,
        context,
        metadata: {
          source: "payment_attempt.finalized",
        },
      })

      const marketing: MarketingEngineModuleService = event.scope.resolve(
        MARKETING_ENGINE_MODULE
      )

      await marketing.recordTouchpoint({
        paymentAttemptId: String(event.payload.attempt.id),
        orderId: event.payload.orderId,
        customerEmail,
        eventName: "payment_attempt.finalized",
        couponCode: context.coupon?.code || null,
        referralCode: context.referral?.code || null,
        source: context.attribution?.source || null,
        medium: context.attribution?.medium || null,
        campaign: context.attribution?.campaign || null,
        content: context.attribution?.content || null,
        term: context.attribution?.term || null,
        metadata: {
          context,
        },
      })
    },
  })

  hooksRegistered = true
}

export async function handleMarketingAttemptClosed(
  scope: MedusaContainer,
  input: {
    attemptId: string
    customerEmail?: string | null
    reason?: string
    payload?: Record<string, unknown> | null
  }
) {
  if (!getPlatformRuntime().isPluginEnabled("marketing-engine")) {
    return
  }

  ensureMarketingStrategiesRegistered()

  const context = extractMarketingContext(input.payload)

  await emitMarketingAttemptClosed({
    scope,
    attemptId: input.attemptId,
    customerEmail: input.customerEmail || null,
    context,
    metadata: {
      reason: input.reason || "attempt_closed",
    },
  })

  const marketing: MarketingEngineModuleService = scope.resolve(
    MARKETING_ENGINE_MODULE
  )

  await marketing.recordTouchpoint({
    paymentAttemptId: input.attemptId,
    customerEmail: input.customerEmail || null,
    eventName: "payment_attempt.closed",
    couponCode: context.coupon?.code || null,
    referralCode: context.referral?.code || null,
    source: context.attribution?.source || null,
    medium: context.attribution?.medium || null,
    campaign: context.attribution?.campaign || null,
    content: context.attribution?.content || null,
    term: context.attribution?.term || null,
    metadata: {
      context,
      reason: input.reason || "attempt_closed",
    },
  })
}

export function resetMarketingHooksForTests() {
  hooksRegistered = false
}

function extractMarketingContext(payload: unknown): MarketingResolvedContext {
  const normalized = normalizeRecord(payload)
  const responsePayload = normalizeRecord(normalized.response_payload)
  const requestPayload = normalizeRecord(normalized.request_payload)
  const direct = normalizeRecord(normalized.marketing_context)
  const fromResponse = normalizeRecord(responsePayload.marketing_context)
  const fromRequest = normalizeRecord(requestPayload.marketing_context)
  const source = Object.keys(fromResponse).length
    ? fromResponse
    : Object.keys(fromRequest).length
      ? fromRequest
      : direct

  return {
    coupon: normalizeCoupon(source.coupon),
    referral: normalizeReferral(source.referral),
    attribution: normalizeAttribution(source.attribution),
    tags: normalizeStringArray(source.tags),
    warnings: normalizeStringArray(source.warnings),
    metadata: normalizeRecord(source.metadata),
  }
}

function extractCustomerEmail(payload: unknown) {
  const normalized = normalizeRecord(payload)
  const requestPayload = normalizeRecord(normalized.request_payload)
  const email = requestPayload.customer_email

  return typeof email === "string" && email.trim()
    ? email.trim().toLowerCase()
    : null
}

function normalizeCoupon(value: unknown) {
  const record = normalizeRecord(value)

  if (!record.code || typeof record.code !== "string") {
    return undefined
  }

  return {
    code: record.code,
    coupon_id:
      typeof record.coupon_id === "string" ? record.coupon_id : undefined,
    campaign_code:
      typeof record.campaign_code === "string" ? record.campaign_code : null,
    offer_code:
      typeof record.offer_code === "string" ? record.offer_code : null,
    reservation_id:
      typeof record.reservation_id === "string"
        ? record.reservation_id
        : undefined,
  }
}

function normalizeReferral(value: unknown) {
  const record = normalizeRecord(value)

  if (!record.code || typeof record.code !== "string") {
    return undefined
  }

  return {
    code: record.code,
    referral_link_id:
      typeof record.referral_link_id === "string"
        ? record.referral_link_id
        : undefined,
    campaign_code:
      typeof record.campaign_code === "string" ? record.campaign_code : null,
  }
}

function normalizeAttribution(value: unknown) {
  const record = normalizeRecord(value)

  return {
    source: asOptionalText(record.source),
    medium: asOptionalText(record.medium),
    campaign: asOptionalText(record.campaign),
    content: asOptionalText(record.content),
    term: asOptionalText(record.term),
  }
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((entry): entry is string => typeof entry === "string")
}

function normalizeRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

function asOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}
