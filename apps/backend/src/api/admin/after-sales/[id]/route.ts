import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveSupportAuditService } from "../../../../platform-adapters/services"
import { emitAuditLog } from "../../../../utils/audit-log"
import { getRequestAuditContext } from "../../../../utils/request-audit"

type UpdateAfterSaleBody = {
  status?: "open" | "processing" | "resolved" | "rejected" | "closed"
  result?: "pending" | "replaced" | "refunded" | "rejected" | "resolved"
  admin_note?: string
}

export const POST = async (
  req: MedusaRequest<UpdateAfterSaleBody>,
  res: MedusaResponse
) => {
  const body = (req.validatedBody || req.body) as UpdateAfterSaleBody
  const supportAudit = resolveSupportAuditService(req.scope)
  const { actorId, ipAddress, userAgent } = getRequestAuditContext(req)

  const afterSale = await supportAudit.updateAfterSale({
    id: req.params.id,
    status: body.status,
    result: body.result,
    adminNote: body.admin_note,
    handledBy: actorId,
  })

  await emitAuditLog(req.scope, {
    actorType: "admin",
    actorId,
    action: "after_sale.updated",
    entityType: "after_sale",
    entityId: afterSale.id,
    riskLevel: "medium",
    ipAddress,
    userAgent,
    metadata: {
      status: afterSale.status,
      result: afterSale.result,
    },
  })

  res.json({
    after_sale: afterSale,
  })
}
