import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolvePaymentRouterService } from "../../../../platform-adapters/services"
import { normalizeAttemptPayload } from "../../../../utils/payment-attempt"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const paymentRouter = resolvePaymentRouterService(req.scope)

  const attemptRecord = await paymentRouter.retrievePaymentAttempt(req.params.id)
  const attempt = await paymentRouter.getPaymentAttemptStatus(req.params.id)
  const payload = normalizeAttemptPayload(attemptRecord.response_payload)

  res.json({
    attempt: {
      ...attempt,
      order_access_claimed_at: payload.order_access_claimed_at || null,
      order_access_claim_token_hint:
        payload.order_access_claim_token_hint || null,
      payment_finalized_at: payload.payment_finalized_at || null,
      payment_finalization_status:
        payload.payment_finalization_status || null,
      payment_finalization_error: payload.payment_finalization_error || null,
      marketing_context:
        payload.marketing_context && typeof payload.marketing_context === "object"
          ? payload.marketing_context
          : null,
    },
  })
}
