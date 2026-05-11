import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import DigitalDeliveryModuleService from "../../../../../../../modules/digital-delivery/service"
import { DIGITAL_DELIVERY_MODULE } from "../../../../../../../modules/digital-delivery"
import GuestOrderAccessModuleService from "../../../../../../../modules/guest-order-access/service"
import { GUEST_ORDER_ACCESS_MODULE } from "../../../../../../../modules/guest-order-access"
import { emitAuditLog } from "../../../../../../../utils/audit-log"
import { getRequestAuditContext } from "../../../../../../../utils/request-audit"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const guestOrderAccess: GuestOrderAccessModuleService = req.scope.resolve(
    GUEST_ORDER_ACCESS_MODULE
  )
  const deliveryService: DigitalDeliveryModuleService = req.scope.resolve(
    DIGITAL_DELIVERY_MODULE
  )
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
