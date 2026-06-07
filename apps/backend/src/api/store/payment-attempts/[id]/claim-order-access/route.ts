import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { ILockingModule } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { emitOrderAccessTokenIssuedEvent } from "../../../../../platform/events"
import { createOrderAccessProviderScope } from "../../../../../platform-adapters/backend-context"
import {
  requireAttemptOrderAccessProviderCode,
  resolveOrderAccessProviderOrThrow,
} from "../../../../../platform-adapters/order-access"
import { resolvePaymentRouterService } from "../../../../../platform-adapters/services"
import {
  isPaymentAttemptFinalized,
  isClaimTemporarilyBlocked,
  markClaimTokenConsumed,
  normalizeAttemptPayload,
  recordFailedClaimAttempt,
} from "../../../../../utils/payment-attempt"
import { hashToken } from "../../../../../utils/token"
import { getRequestAuditContext } from "../../../../../utils/request-audit"

type ClaimOrderAccessBody = {
  claim_token?: string
}

export const POST = async (
  req: MedusaRequest<ClaimOrderAccessBody>,
  res: MedusaResponse
) => {
  const body = (req.validatedBody || req.body) as ClaimOrderAccessBody

  const paymentRouter = resolvePaymentRouterService(req.scope)
  const locking: ILockingModule = req.scope.resolve(Modules.LOCKING)
  const orderAccessScope = createOrderAccessProviderScope(req.scope)

  const { ipAddress, userAgent } = getRequestAuditContext(req)
  const lockKey = `payment-attempt-claim:${req.params.id}`
  const claimResult = await locking.execute(
    lockKey,
    async () => {
      const attempt = await paymentRouter.retrievePaymentAttempt(req.params.id)

      if (
        attempt.status !== "paid" ||
        !attempt.order_id ||
        !isPaymentAttemptFinalized(attempt.response_payload)
      ) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Payment attempt is not ready for order access"
        )
      }

      const payload = normalizeAttemptPayload(attempt.response_payload)
      const orderAccessProviderCode = requireAttemptOrderAccessProviderCode(
        attempt.response_payload
      )
      const orderAccess = resolveOrderAccessProviderOrThrow(
        orderAccessProviderCode
      )

      if (
        !payload.order_access_claim_token_hash ||
        payload.order_access_claimed_at
      ) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Order access can no longer be claimed from this payment attempt"
        )
      }

      if (isClaimTemporarilyBlocked(payload)) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Too many invalid claim attempts. Please retry later."
        )
      }

      if (payload.order_access_claim_token_hash !== hashToken(body.claim_token || "")) {
        await paymentRouter.updatePaymentAttempts({
          id: attempt.id,
          response_payload: recordFailedClaimAttempt(attempt.response_payload),
        })
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Invalid order access claim token"
        )
      }

      const customerEmail =
        String(
          (attempt.request_payload as Record<string, unknown> | null)
            ?.customer_email || ""
        ) || ""

      const { token } = await orderAccess.issueToken({
        scope: orderAccessScope,
        orderId: attempt.order_id,
        customerEmail,
        purpose: "view_order",
      })

      try {
        await paymentRouter.updatePaymentAttempts({
          id: attempt.id,
          response_payload: markClaimTokenConsumed(attempt.response_payload),
        })
      } catch (error) {
        await orderAccess.revokeActiveTokens({
          scope: orderAccessScope,
          orderId: attempt.order_id,
          purpose: "view_order",
        })
        throw error
      }

      return {
        orderId: attempt.order_id,
        customerEmail,
        attemptId: attempt.id,
        accessToken: token,
      }
    },
    {
      timeout: 30,
    }
  )

  await emitOrderAccessTokenIssuedEvent(req.scope, {
    orderId: claimResult.orderId,
    customerEmail: claimResult.customerEmail,
    purpose: "view_order",
    source: "payment_attempt_claim",
    actorType: "guest",
    ipAddress,
    userAgent,
    metadata: {
      payment_attempt_id: claimResult.attemptId,
    },
  })

  res.json({
    order_id: claimResult.orderId,
    access_token: claimResult.accessToken,
  })
}
