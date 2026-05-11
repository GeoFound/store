import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import DigitalDeliveryModuleService from "../../../../../../../modules/digital-delivery/service"
import { DIGITAL_DELIVERY_MODULE } from "../../../../../../../modules/digital-delivery"
import GuestOrderAccessModuleService from "../../../../../../../modules/guest-order-access/service"
import { GUEST_ORDER_ACCESS_MODULE } from "../../../../../../../modules/guest-order-access"
import SupportAuditModuleService from "../../../../../../../modules/support-audit/service"
import { SUPPORT_AUDIT_MODULE } from "../../../../../../../modules/support-audit"
import { emitAuditLog } from "../../../../../../../utils/audit-log"
import { getRequestAuditContext } from "../../../../../../../utils/request-audit"

type CreateAfterSaleBody = {
  email?: string
  reason?: "not_working" | "wrong_item" | "duplicate" | "refund" | "other"
  message?: string
}

export const POST = async (
  req: MedusaRequest<CreateAfterSaleBody>,
  res: MedusaResponse
) => {
  if (!req.body.message) {
    res.status(400).json({
      message: "message is required",
    })
    return
  }

  const guestOrderAccess: GuestOrderAccessModuleService = req.scope.resolve(
    GUEST_ORDER_ACCESS_MODULE
  )
  const deliveryService: DigitalDeliveryModuleService = req.scope.resolve(
    DIGITAL_DELIVERY_MODULE
  )
  const supportAudit: SupportAuditModuleService =
    req.scope.resolve(SUPPORT_AUDIT_MODULE)
  const { ipAddress, userAgent } = getRequestAuditContext(req)
  const token = await guestOrderAccess.resolveViewToken(req.params.access_token)
  const result = await deliveryService.retrieveOrderDeliveryForOrder({
    orderId: String(token.order_id),
    deliveryId: req.params.delivery_id,
  })

  const afterSale = await supportAudit.createAfterSale({
    deliveryId: String(result.delivery.id),
    orderId: toOptionalString(result.delivery.order_id),
    cartId: toOptionalString(result.delivery.cart_id),
    paymentAttemptId: toOptionalString(result.delivery.payment_attempt_id),
    accountItemId: toOptionalString(result.delivery.account_item_id),
    customerEmail:
      req.body.email || toOptionalString(token.customer_email) || undefined,
    reason: req.body.reason,
    message: req.body.message,
  })

  await emitAuditLog(req.scope, {
    actorType: "guest",
    action: "after_sale.created",
    entityType: "after_sale",
    entityId: afterSale.id,
    riskLevel: "medium",
    ipAddress,
    userAgent,
    metadata: {
      order_id: token.order_id,
      delivery_id: result.delivery.id,
      reason: req.body.reason || "other",
    },
  })

  res.status(201).json({
    after_sale: afterSale,
  })
}

function toOptionalString(value: unknown) {
  return typeof value === "string" ? value : undefined
}
