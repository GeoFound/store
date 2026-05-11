import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  resolveDigitalDeliveryService,
  resolveGuestOrderAccessService,
} from "../../../../../../../platform/services"
import { emitAuditLog } from "../../../../../../../utils/audit-log"
import { getRequestAuditContext } from "../../../../../../../utils/request-audit"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const guestOrderAccess = resolveGuestOrderAccessService(req.scope)
  const deliveryService = resolveDigitalDeliveryService(req.scope)
  const { ipAddress, userAgent } = getRequestAuditContext(req)
  const token = await guestOrderAccess.resolveViewToken(req.params.access_token)
  const delivery = await deliveryService.confirmOrderDelivery({
    orderId: String(token.order_id),
    deliveryId: req.params.delivery_id,
  })

  await emitAuditLog(req.scope, {
    actorType: "guest",
    action: "delivery.confirmed",
    entityType: "order_delivery",
    entityId: String(delivery.id),
    riskLevel: "medium",
    ipAddress,
    userAgent,
    metadata: {
      order_id: token.order_id,
    },
  })

  res.json({
    delivery,
  })
}
