import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveSupportAuditService } from "../../../platform-adapters/services"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const supportAudit = resolveSupportAuditService(req.scope)
  const query = (req.validatedQuery || req.query) as {
    status?: string
    delivery_id?: string
    limit?: number
  }

  const afterSales = await supportAudit.listAfterSalesSafe({
    status: query.status,
    deliveryId: query.delivery_id,
    limit:
      typeof query.limit === "number" && Number.isFinite(query.limit)
        ? query.limit
        : undefined,
  })

  res.json({
    after_sales: afterSales,
  })
}
