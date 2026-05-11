import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveSupportAuditService } from "../../../platform/services"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const supportAudit = resolveSupportAuditService(req.scope)
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
