import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  resolveDigitalDeliveryService,
  resolveGuestOrderAccessService,
} from "../../../../platform/services"
import { emitAuditLog } from "../../../../utils/audit-log"
import { getRequestAuditContext } from "../../../../utils/request-audit"
import { retrieveStoreOrderDetail } from "../../../../utils/store-order"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const guestOrderAccess = resolveGuestOrderAccessService(req.scope)
  const deliveryService = resolveDigitalDeliveryService(req.scope)
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
