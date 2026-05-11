import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import CredentialInventoryModuleService from "../../../../modules/credential-inventory/service"
import { CREDENTIAL_INVENTORY_MODULE } from "../../../../modules/credential-inventory"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const inventory: CredentialInventoryModuleService = req.scope.resolve(
    CREDENTIAL_INVENTORY_MODULE
  )
  const query = (req.validatedQuery || req.query) as {
    product_variant_id?: string
    limit?: number
  }

  const soldItems = await inventory.listAccountItemsSafe({
    productVariantId: query.product_variant_id,
    status: "sold",
    limit:
      typeof query.limit === "number" && Number.isFinite(query.limit)
        ? query.limit
        : undefined,
  })

  res.json({
    items: soldItems.filter((item) => !item.delivered_at),
  })
}
