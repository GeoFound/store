import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import SupportAuditModuleService from "../../../../modules/support-audit/service"
import { SUPPORT_AUDIT_MODULE } from "../../../../modules/support-audit"
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
  const supportAudit: SupportAuditModuleService =
    req.scope.resolve(SUPPORT_AUDIT_MODULE)
  const { actorId, ipAddress, userAgent } = getRequestAuditContext(req)

  const afterSale = await supportAudit.updateAfterSale({
    id: req.params.id,
    status: req.body.status,
    result: req.body.result,
    adminNote: req.body.admin_note,
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
