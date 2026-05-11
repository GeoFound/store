import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveDigitalDeliveryService } from "../../../../../platform/services"
import { emitAuditLog } from "../../../../../utils/audit-log"
import { getRequestAuditContext } from "../../../../../utils/request-audit"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const deliveryService = resolveDigitalDeliveryService(req.scope)
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
