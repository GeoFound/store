import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PAYMENT_ROUTER_MODULE } from "../../../../modules/payment-router"
import type PaymentRouterModuleService from "../../../../modules/payment-router/service"
import { getPaymentProvider } from "../../../../modules/payment-router/providers/registry"
import { handleMarketingAttemptClosed } from "../../../../modules/marketing-engine/hooks"
import { emitAuditLog } from "../../../../utils/audit-log"
import finalizeSuccessfulPaymentAttemptWorkflow from "../../../../workflows/finalize-successful-payment-attempt"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const providerCode = req.params.provider_code
  const provider = getPaymentProvider(providerCode)
  const body = (req.validatedBody || req.body) as Record<string, unknown>
  const paymentRouter: PaymentRouterModuleService =
    req.scope.resolve(PAYMENT_ROUTER_MODULE)

  if (!provider?.parseWebhook) {
    res.status(404).json({
      message: `Payment webhook provider ${providerCode} is not registered`,
    })
    return
  }

  let webhook
  try {
    webhook = provider.parseWebhook(body, {
      headers: req.headers as Record<string, string | string[] | undefined>,
      rawBody: req.rawBody as Buffer | string | undefined,
    })
  } catch (err) {
    res.status(400).json({
      message: err instanceof Error ? err.message : "Invalid payment webhook",
    })
    return
  }

  if (webhook.status !== "paid") {
    const existingAttempt =
      await paymentRouter.retrievePaymentAttemptByProviderOrderId({
        providerOrderId: webhook.providerOrderId,
        providerCode,
      })
    const callbackPayload = {
      source: "provider_webhook",
      provider_code: providerCode,
      payload: webhook.payload,
    }
    const attempt =
      webhook.status === "expired"
        ? await paymentRouter.markAttemptExpired({
            id: existingAttempt.id,
            callbackPayload,
          })
        : await paymentRouter.markAttemptFailed({
            id: existingAttempt.id,
            errorMessage: `Provider reported ${webhook.status}`,
            callbackPayload,
          })

    try {
      await handleMarketingAttemptClosed(req.scope, {
        attemptId: attempt.id,
        customerEmail:
          typeof attempt.request_payload === "object" &&
          attempt.request_payload &&
          typeof (attempt.request_payload as Record<string, unknown>)
            .customer_email === "string"
            ? String(
                (attempt.request_payload as Record<string, unknown>)
                  .customer_email
              )
            : null,
        reason:
          webhook.status === "expired" ? "provider_expired" : "provider_failed",
        payload: (attempt.response_payload as Record<string, unknown> | null) || null,
      })
    } catch {
      // Marketing close handlers are best-effort and must not block webhook handling.
    }

    await emitAuditLog(req.scope, {
      actorType: "webhook",
      action: `payment_attempt.webhook_${webhook.status}`,
      entityType: "payment_attempt",
      entityId: attempt.id,
      riskLevel: "high",
      metadata: {
        provider_code: providerCode,
        provider_order_id: attempt.provider_order_id,
      },
    })

    res.json({
      attempt,
    })
    return
  }

  const existingAttempt = await paymentRouter.retrievePaymentAttemptByProviderOrderId({
    providerOrderId: webhook.providerOrderId,
    providerCode,
  })

  if (!["pending", "paid"].includes(existingAttempt.status)) {
    await emitAuditLog(req.scope, {
      actorType: "webhook",
      action: "payment_attempt.webhook_paid_ignored",
      entityType: "payment_attempt",
      entityId: existingAttempt.id,
      riskLevel: "medium",
      metadata: {
        provider_code: providerCode,
        provider_order_id: existingAttempt.provider_order_id,
        status: existingAttempt.status,
      },
    })

    res.status(202).json({
      attempt: existingAttempt,
      ignored: true,
      reason: `attempt_status_${existingAttempt.status}`,
    })
    return
  }

  const result = (
    await finalizeSuccessfulPaymentAttemptWorkflow(req.scope).run({
      input: {
        providerOrderId: webhook.providerOrderId,
        providerCode,
        callbackPayload: {
          source: "provider_webhook",
          provider_code: providerCode,
          payload: webhook.payload,
        },
      },
    })
  ).result
  const attempt = result.attempt

  await emitAuditLog(req.scope, {
    actorType: "webhook",
    action: "payment_attempt.webhook_paid",
    entityType: "payment_attempt",
    entityId: attempt.id,
    riskLevel: "high",
    metadata: {
      provider_code: providerCode,
      provider_order_id: attempt.provider_order_id,
      order_id: result.order_id,
    },
  })

  res.json({
    attempt,
    order_id: result.order_id,
  })
}
