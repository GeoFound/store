import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { emitAuditLog } from "../../../../../utils/audit-log"
import { getRequestAuditContext } from "../../../../../utils/request-audit"
import finalizeSuccessfulPaymentAttemptWorkflow from "../../../../../workflows/finalize-successful-payment-attempt"

type MarkPaidBody = {
  note?: string
}

export const POST = async (
  req: MedusaRequest<MarkPaidBody>,
  res: MedusaResponse
) => {
  const body = (req.validatedBody || req.body) as MarkPaidBody
  const { actorId, ipAddress, userAgent } = getRequestAuditContext(req)

  const result = (
    await finalizeSuccessfulPaymentAttemptWorkflow(req.scope).run({
      input: {
        attemptId: req.params.id,
        callbackPayload: {
          source: "admin_mark_paid",
          note: body.note || null,
        },
      },
    })
  ).result
  const attempt = result.attempt

  await emitAuditLog(req.scope, {
    actorType: "admin",
    actorId,
    action: "payment_attempt.mark_paid",
    entityType: "payment_attempt",
    entityId: attempt.id,
    riskLevel: "high",
    ipAddress,
    userAgent,
    metadata: {
      provider_order_id: attempt.provider_order_id,
      note: body.note || null,
      order_id: result.order_id,
    },
  })

  res.json({
    attempt,
    order_id: result.order_id,
  })
}
