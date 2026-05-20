import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  listLocalizedProductTemplates,
} from "../../../platform/product-templates"
import { resolveRequestLocale } from "../../../utils/localized-response"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  res.json({
    templates: listLocalizedProductTemplates(resolveRequestLocale(req)),
  })
}
