import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import DigitalDeliveryModuleService from "../../../../modules/digital-delivery/service"
import { DIGITAL_DELIVERY_MODULE } from "../../../../modules/digital-delivery"
import { emitAuditLog } from "../../../../utils/audit-log"
import { getRequestAuditContext } from "../../../../utils/request-audit"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const deliveryService: DigitalDeliveryModuleService = req.scope.resolve(
    DIGITAL_DELIVERY_MODULE
  )
  const { ipAddress, userAgent } = getRequestAuditContext(req)

  const result = await deliveryService.retrieveDeliveryByAccessToken(
    req.params.access_token
  )

  await emitAuditLog(req.scope, {
    actorType: "guest",
    action: "delivery.viewed",
    entityType: "order_delivery",
    entityId: String(result.delivery.id),
    riskLevel: "high",
    ipAddress,
    userAgent,
    metadata: {
      access_token_hint: result.delivery.access_token_hint,
    },
  })

  res.json(result)
}
