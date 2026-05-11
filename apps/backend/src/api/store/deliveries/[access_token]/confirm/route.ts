import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import DigitalDeliveryModuleService from "../../../../../modules/digital-delivery/service"
import { DIGITAL_DELIVERY_MODULE } from "../../../../../modules/digital-delivery"
import { emitAuditLog } from "../../../../../utils/audit-log"
import { getRequestAuditContext } from "../../../../../utils/request-audit"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const deliveryService: DigitalDeliveryModuleService = req.scope.resolve(
    DIGITAL_DELIVERY_MODULE
  )
  const { ipAddress, userAgent } = getRequestAuditContext(req)

  const delivery = await deliveryService.confirmDelivery(
    req.params.access_token
  )

  await emitAuditLog(req.scope, {
    actorType: "guest",
    action: "delivery.confirmed",
    entityType: "order_delivery",
    entityId: String(delivery.id),
    riskLevel: "medium",
    ipAddress,
    userAgent,
  })

  res.json({
    delivery,
  })
}
