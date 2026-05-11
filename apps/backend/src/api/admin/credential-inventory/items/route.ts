import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveCredentialInventoryService } from "../../../../platform/services"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const inventory = resolveCredentialInventoryService(req.scope)
  const query = (req.validatedQuery || req.query) as {
    product_variant_id?: string
    status?: string
    limit?: number
  }

  const items = await inventory.listAccountItemsSafe({
    productVariantId: query.product_variant_id,
    status: query.status,
    limit:
      typeof query.limit === "number" && Number.isFinite(query.limit)
        ? query.limit
        : undefined,
  })

  res.json({
    items,
  })
}
