import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import DigitalDeliveryModuleService from "../../../../../modules/digital-delivery/service"
import { DIGITAL_DELIVERY_MODULE } from "../../../../../modules/digital-delivery"
import SupportAuditModuleService from "../../../../../modules/support-audit/service"
import { SUPPORT_AUDIT_MODULE } from "../../../../../modules/support-audit"
import { emitAuditLog } from "../../../../../utils/audit-log"
import { getRequestAuditContext } from "../../../../../utils/request-audit"

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

  const deliveryService: DigitalDeliveryModuleService = req.scope.resolve(
    DIGITAL_DELIVERY_MODULE
  )
  const supportAudit: SupportAuditModuleService =
    req.scope.resolve(SUPPORT_AUDIT_MODULE)
  const { ipAddress, userAgent } = getRequestAuditContext(req)
  const result = await deliveryService.retrieveDeliveryByAccessToken(
    req.params.access_token
  )

  const afterSale = await supportAudit.createAfterSale({
    deliveryId: String(result.delivery.id),
    orderId: toOptionalString(result.delivery.order_id),
    cartId: toOptionalString(result.delivery.cart_id),
    paymentAttemptId: toOptionalString(result.delivery.payment_attempt_id),
    accountItemId: toOptionalString(result.delivery.account_item_id),
    customerEmail: req.body.email,
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
