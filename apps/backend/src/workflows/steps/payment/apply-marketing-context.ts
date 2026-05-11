import type { MedusaContainer } from "@medusajs/framework/types"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import type {
  MarketingCheckoutContextInput,
  MarketingResolvedContext,
} from "../../../platform/marketing"
import { resolveMarketingContext } from "../../../platform/marketing"
import {
  ensurePlatformIntegrationsRegistered,
} from "../../../platform/integrations"
import { isPlatformPluginEnabled } from "../../../platform/runtime"
import PaymentRouterModuleService from "../../../modules/payment-router/service"
import { PAYMENT_ROUTER_MODULE } from "../../../modules/payment-router"
import { MARKETING_ENGINE_MODULE } from "../../../modules/marketing-engine"
import type MarketingEngineModuleService from "../../../modules/marketing-engine/service"
import { handleMarketingAttemptClosed } from "../../../modules/marketing-engine/hooks"

export type ApplyMarketingContextStepInput = {
  attemptId: string
  cartId: string
  amount: number
  currency: string
  customerEmail?: string | null
  context?: MarketingCheckoutContextInput | null
  attemptRequestPayload?: Record<string, unknown> | null
  attemptResponsePayload?: Record<string, unknown> | null
}

export const applyMarketingContextStep = createStep(
  "apply-marketing-context",
  async (
    input: ApplyMarketingContextStepInput,
    { container }: { container: MedusaContainer }
  ) => {
    ensurePlatformIntegrationsRegistered()

    const paymentRouter: PaymentRouterModuleService = container.resolve(
      PAYMENT_ROUTER_MODULE
    )

    if (!isPlatformPluginEnabled("marketing-engine")) {
      const attempt = await paymentRouter.retrievePaymentAttempt(input.attemptId)

      return new StepResponse({
        attempt,
        marketingContext: createEmptyMarketingContext(),
      })
    }

    const marketing: MarketingEngineModuleService = container.resolve(
      MARKETING_ENGINE_MODULE
    )

    try {
      const normalizedContext = normalizeCheckoutContext(input.context)
      const resolved = await resolveMarketingContext({
        scope: container,
        attemptId: input.attemptId,
        cartId: input.cartId,
        amount: input.amount,
        currency: input.currency,
        customerEmail: input.customerEmail || null,
        context: normalizedContext,
        resolved: createEmptyMarketingContext(),
      })

      const requestPayload = {
        ...(input.attemptRequestPayload || {}),
        marketing_input: normalizedContext,
        marketing_context: resolved,
      }

      const responsePayload = {
        ...(input.attemptResponsePayload || {}),
        marketing_context: resolved,
      }

      const attempt = await paymentRouter.updatePaymentAttempts({
        id: input.attemptId,
        request_payload: requestPayload,
        response_payload: responsePayload,
      })

      await marketing.recordTouchpoint({
        cartId: input.cartId,
        paymentAttemptId: input.attemptId,
        customerEmail: input.customerEmail || null,
        eventName: "checkout_context_attached",
        couponCode: resolved.coupon?.code || null,
        referralCode: resolved.referral?.code || null,
        source: resolved.attribution?.source || null,
        medium: resolved.attribution?.medium || null,
        campaign: resolved.attribution?.campaign || null,
        content: resolved.attribution?.content || null,
        term: resolved.attribution?.term || null,
        metadata: {
          input: normalizedContext,
          resolved,
        },
      })

      return new StepResponse({
        attempt,
        marketingContext: resolved,
      })
    } catch (err) {
      const failedAttempt = await paymentRouter.markAttemptFailed({
        id: input.attemptId,
        errorMessage:
          err instanceof Error
            ? err.message
            : "Failed to apply marketing context",
        callbackPayload: {
          source: "marketing_context",
        },
      })

      try {
        await handleMarketingAttemptClosed(container, {
          attemptId: input.attemptId,
          customerEmail: input.customerEmail || null,
          reason: "marketing_context_failed",
          payload:
            (failedAttempt.response_payload as Record<string, unknown> | null) ||
            (input.attemptResponsePayload || null),
        })
      } catch {
        // Best-effort cleanup; keep original error.
      }

      throw err
    }
  }
)

function normalizeCheckoutContext(input?: MarketingCheckoutContextInput | null) {
  const context = input || {}

  return {
    coupon_code: normalizeText(context.coupon_code),
    referral_code: normalizeText(context.referral_code),
    utm_source: normalizeText(context.utm_source),
    utm_medium: normalizeText(context.utm_medium),
    utm_campaign: normalizeText(context.utm_campaign),
    utm_content: normalizeText(context.utm_content),
    utm_term: normalizeText(context.utm_term),
  }
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()

  return trimmed ? trimmed.slice(0, 160) : undefined
}

function createEmptyMarketingContext(): MarketingResolvedContext {
  return {
    tags: [],
    warnings: [],
    metadata: {},
  }
}
