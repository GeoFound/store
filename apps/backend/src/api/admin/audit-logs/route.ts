import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import SupportAuditModuleService from "../../../modules/support-audit/service"
import { SUPPORT_AUDIT_MODULE } from "../../../modules/support-audit"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const supportAudit: SupportAuditModuleService =
    req.scope.resolve(SUPPORT_AUDIT_MODULE)
  const query = (req.validatedQuery || req.query) as {
    action?: string
    entity_type?: string
    entity_id?: string
    limit?: number
  }

  const auditLogs = await supportAudit.listAuditLogsSafe({
    action: query.action,
    entityType: query.entity_type,
    entityId: query.entity_id,
    limit:
      typeof query.limit === "number" && Number.isFinite(query.limit)
        ? query.limit
        : undefined,
  })

  res.json({
    audit_logs: auditLogs,
  })
}
