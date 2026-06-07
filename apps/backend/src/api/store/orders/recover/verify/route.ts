import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { emitOrderAccessTokenIssuedEvent } from "../../../../../platform/events"
import { getOrderAccessProvider } from "../../../../../platform/order-access"
import { resolveGuestOrderAccessService } from "../../../../../platform-adapters/services"
import { localizedError } from "../../../../../utils/localized-response"
import { getRequestAuditContext } from "../../../../../utils/request-audit"
import { retrieveStoreOrderDetail } from "../../../../../utils/store-order"

type VerifyRecoveryBody = {
  order_id?: string
  code?: string
}

export const POST = async (
  req: MedusaRequest<VerifyRecoveryBody>,
  res: MedusaResponse
) => {
  const body = (req.validatedBody || req.body) as VerifyRecoveryBody

  const orderAccess = getOrderAccessProvider("guest-order-access")

  if (!orderAccess) {
    localizedError(req, res, 503, "orderAccess.providerUnavailable")
    return
  }

  const guestOrderAccess = resolveGuestOrderAccessService(req.scope)
  const locking: ILockingModule = req.scope.resolve(Modules.LOCKING)
  const { ipAddress, userAgent } = getRequestAuditContext(req)
  const order = await retrieveStoreOrderDetail(req.scope, body.order_id || "", [
    "id",
    "email",
  ])

  const lockKey = `order-recovery:${String(order.id)}:${String(order.email).toLowerCase()}`
  const token = await locking.execute(
    lockKey,
    async () => {
      await guestOrderAccess.verifyRecoveryCode({
        orderId: String(order.id),
        customerEmail: String(order.email),
        code: body.code || "",
      })

      const issued = await orderAccess.issueToken({
        scope: req.scope,
        orderId: String(order.id),
        customerEmail: String(order.email),
        purpose: "view_order",
        metadata: {
          source: "store_order_recovery_verify",
        },
      })

      return issued.token
    },
    {
      timeout: 30,
    }
  )

  await emitOrderAccessTokenIssuedEvent(req.scope, {
    orderId: String(order.id),
    customerEmail: String(order.email),
    purpose: "view_order",
    source: "store_order_recovery_verify",
    actorType: "guest",
    ipAddress,
    userAgent,
    metadata: {
      recovery_code_verified: true,
    },
  })

  res.json({
    order_id: order.id,
    access_token: token,
  })
}
