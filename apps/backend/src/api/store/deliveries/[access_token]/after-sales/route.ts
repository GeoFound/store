import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  resolveDigitalDeliveryService,
  resolveSupportAuditService,
} from "../../../../../platform-adapters/services"
import { emitAuditLog } from "../../../../../utils/audit-log"
import { localizedError } from "../../../../../utils/localized-response"
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
  const body = (req.validatedBody || req.body) as CreateAfterSaleBody

  if (!body.message) {
    localizedError(req, res, 400, "common.messageRequired")
    return
  }

  const deliveryService = resolveDigitalDeliveryService(req.scope)
  const supportAudit = resolveSupportAuditService(req.scope)
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
    customerEmail: body.email,
    reason: body.reason,
    message: body.message,
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
      reason: body.reason || "other",
    },
  })

  res.status(201).json({
    after_sale: afterSale,
  })
}

function toOptionalString(value: unknown) {
  return typeof value === "string" ? value : undefined
}
