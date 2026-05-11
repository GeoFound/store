import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import GuestOrderAccessModuleService from "../../../../modules/guest-order-access/service"
import { GUEST_ORDER_ACCESS_MODULE } from "../../../../modules/guest-order-access"
import { ensureGuestOrderAccessHooksRegistered } from "../../../../modules/guest-order-access/hooks"
import { emitOrderAccessRecoveryCodeCreatedEvent } from "../../../../platform/events"
import { emitAuditLog } from "../../../../utils/audit-log"
import { getRequestAuditContext } from "../../../../utils/request-audit"
import { normalizeEmail, retrieveStoreOrderDetail } from "../../../../utils/store-order"

type RecoverOrderBody = {
  email?: string
  order_id?: string
}

export const POST = async (
  req: MedusaRequest<RecoverOrderBody>,
  res: MedusaResponse
) => {
  const body = (req.validatedBody || req.body) as RecoverOrderBody

  const guestOrderAccess: GuestOrderAccessModuleService = req.scope.resolve(
    GUEST_ORDER_ACCESS_MODULE
  )
  const { ipAddress, userAgent } = getRequestAuditContext(req)
  const order = await retrieveStoreOrderDetail(req.scope, body.order_id || "", [
    "id",
    "email",
  ])

  if (normalizeEmail(order.email) !== normalizeEmail(body.email || "")) {
    res.status(404).json({
      message: "Order was not found",
    })
    return
  }

  const recovery = await guestOrderAccess.createRecoveryCode({
    orderId: String(order.id),
    customerEmail: String(order.email),
    metadata: {
      source: "store_order_recovery",
    },
  })

  ensureGuestOrderAccessHooksRegistered()
  await emitOrderAccessRecoveryCodeCreatedEvent(req.scope, {
    orderId: String(order.id),
    customerEmail: String(order.email),
    code: recovery.token,
    expiresAt:
      recovery.record.expires_at instanceof Date
        ? recovery.record.expires_at.toISOString()
        : String(recovery.record.expires_at || ""),
  })

  await emitAuditLog(req.scope, {
    actorType: "guest",
    action: "order.recovery_requested",
    entityType: "order",
    entityId: String(order.id),
    riskLevel: "medium",
    ipAddress,
    userAgent,
    metadata: {
      customer_email: normalizeEmail(order.email),
    },
  })

  res.status(202).json({
    order_id: order.id,
    expires_at: recovery.record.expires_at || null,
  })
}
