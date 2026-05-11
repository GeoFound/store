import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import PaymentRouterModuleService from "../../../../modules/payment-router/service"
import { PAYMENT_ROUTER_MODULE } from "../../../../modules/payment-router"
import { normalizeAttemptPayload } from "../../../../utils/payment-attempt"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const paymentRouter: PaymentRouterModuleService =
    req.scope.resolve(PAYMENT_ROUTER_MODULE)

  const attemptRecord = await paymentRouter.retrievePaymentAttempt(req.params.id)
  const attempt = await paymentRouter.getPaymentAttemptStatus(req.params.id)
  const payload = normalizeAttemptPayload(attemptRecord.response_payload)

  res.json({
    attempt: {
      ...attempt,
      order_access_claimed_at: payload.order_access_claimed_at || null,
      order_access_claim_token_hint:
        payload.order_access_claim_token_hint || null,
      marketing_context:
        payload.marketing_context && typeof payload.marketing_context === "object"
          ? payload.marketing_context
          : null,
    },
  })
}
