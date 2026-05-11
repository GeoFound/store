import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listProductTemplates } from "../../../platform/product-templates"

export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  res.json({
    templates: listProductTemplates(),
  })
}
