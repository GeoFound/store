import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { handlePaymentAttemptClosed } from "../../../platform/attempt-lifecycle"
import { getPaymentProvider } from "../../../platform/payment-providers"
import { resolvePaymentRouterService } from "../../../platform-adapters/services"
import { emitAuditLog } from "../../../utils/audit-log"
import finalizeSuccessfulPaymentAttemptWorkflow from "../../../workflows/finalize-successful-payment-attempt"

export async function handlePaymentWebhook(
  req: MedusaRequest,
  res: MedusaResponse,
  input: {
    providerCode: string
    source: string
  }
) {
  const provider = getPaymentProvider(input.providerCode)
  const body = (req.validatedBody || req.body) as Record<string, unknown>
  const paymentRouter = resolvePaymentRouterService(req.scope)

  if (!provider?.parseWebhook) {
    res.status(404).json({
      message: `Payment webhook provider ${input.providerCode} is not registered`,
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

  if (webhook.status === "pending") {
    res.status(202).json({
      ignored: true,
      provider_order_id: webhook.providerOrderId,
      status: webhook.status,
    })
    return
  }

  if (webhook.status !== "paid") {
    const existingAttempt =
      await paymentRouter.retrievePaymentAttemptByProviderOrderId({
        providerOrderId: webhook.providerOrderId,
        providerCode: input.providerCode,
      })
    if (existingAttempt.status === "paid") {
      await emitAuditLog(req.scope, {
        actorType: "webhook",
        action: `payment_attempt.webhook_${webhook.status}_ignored`,
        entityType: "payment_attempt",
        entityId: existingAttempt.id,
        riskLevel: "medium",
        metadata: {
          provider_code: input.providerCode,
          provider_order_id: existingAttempt.provider_order_id,
          status: existingAttempt.status,
        },
      })

      res.status(202).json({
        attempt: existingAttempt,
        ignored: true,
        reason: "attempt_already_paid",
      })
      return
    }

    const callbackPayload = {
      source: input.source,
      provider_code: input.providerCode,
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
      await handlePaymentAttemptClosed(req.scope, {
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
        provider_code: input.providerCode,
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
    providerCode: input.providerCode,
  })

  if (!["pending", "paid"].includes(existingAttempt.status)) {
    await emitAuditLog(req.scope, {
      actorType: "webhook",
      action: "payment_attempt.webhook_paid_ignored",
      entityType: "payment_attempt",
      entityId: existingAttempt.id,
      riskLevel: "medium",
      metadata: {
        provider_code: input.providerCode,
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
        providerCode: input.providerCode,
        callbackPayload: {
          source: input.source,
          provider_code: input.providerCode,
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
      provider_code: input.providerCode,
      provider_order_id: attempt.provider_order_id,
      order_id: result.order_id,
    },
  })

  res.json({
    attempt,
    order_id: result.order_id,
  })
}
