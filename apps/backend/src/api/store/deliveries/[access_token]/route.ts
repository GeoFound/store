import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveDigitalDeliveryService } from "../../../../platform-adapters/services"
import { emitAuditLog } from "../../../../utils/audit-log"
import { getRequestAuditContext } from "../../../../utils/request-audit"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const deliveryService = resolveDigitalDeliveryService(req.scope)
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
