import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import DigitalDeliveryModuleService from "../../../../modules/digital-delivery/service"
import { DIGITAL_DELIVERY_MODULE } from "../../../../modules/digital-delivery"
import GuestOrderAccessModuleService from "../../../../modules/guest-order-access/service"
import { GUEST_ORDER_ACCESS_MODULE } from "../../../../modules/guest-order-access"
import { emitAuditLog } from "../../../../utils/audit-log"
import { getRequestAuditContext } from "../../../../utils/request-audit"
import { retrieveStoreOrderDetail } from "../../../../utils/store-order"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const guestOrderAccess: GuestOrderAccessModuleService = req.scope.resolve(
    GUEST_ORDER_ACCESS_MODULE
  )
  const deliveryService: DigitalDeliveryModuleService = req.scope.resolve(
    DIGITAL_DELIVERY_MODULE
  )
  const { ipAddress, userAgent } = getRequestAuditContext(req)
  const token = await guestOrderAccess.resolveViewToken(req.params.access_token)
  const order = await retrieveStoreOrderDetail(req.scope, String(token.order_id))
  const deliveries = await deliveryService.listOrderDeliveriesDetailed(
    String(token.order_id)
  )

  await emitAuditLog(req.scope, {
    actorType: "guest",
    action: "order.viewed",
    entityType: "order",
    entityId: String(order.id),
    riskLevel: "high",
    ipAddress,
    userAgent,
    metadata: {
      order_access_token_hint: token.token_hint || null,
      delivery_count: deliveries.length,
    },
  })

  res.json({
    order,
    deliveries,
  })
}
