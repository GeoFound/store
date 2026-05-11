import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getPaymentProvider } from "../../../../platform/payment-providers"
import { emitAuditLog } from "../../../../utils/audit-log"
import finalizeSuccessfulPaymentAttemptWorkflow from "../../../../workflows/finalize-successful-payment-attempt"

type ManualWebhookBody = {
  provider_order_id?: string
  status?: "paid"
}

export const POST = async (
  req: MedusaRequest<ManualWebhookBody>,
  res: MedusaResponse
) => {
  const body = (req.validatedBody || req.body) as ManualWebhookBody
  let webhook
  try {
    const provider = getPaymentProvider("manual")
    if (!provider?.parseWebhook) {
      throw new Error("Payment provider manual is not registered for webhooks")
    }

    webhook = provider.parseWebhook(body, {
      headers: req.headers as Record<string, string | string[] | undefined>,
      rawBody: req.rawBody as Buffer | string | undefined,
    })
  } catch (err) {
    res.status(400).json({
      message: err instanceof Error ? err.message : "Invalid manual webhook",
    })
    return
  }

  const result = (
    await finalizeSuccessfulPaymentAttemptWorkflow(req.scope).run({
      input: {
        providerOrderId: webhook.providerOrderId,
        providerCode: "manual",
        callbackPayload: {
          source: "manual_webhook",
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
      provider_code: "manual",
      provider_order_id: attempt.provider_order_id,
      order_id: result.order_id,
    },
  })

  res.json({
    attempt,
    order_id: result.order_id,
  })
}
