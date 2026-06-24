import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveStorefrontProductTemplateApplication } from "../../../platform-adapters/product-templates-application"
import { resolveRequestLocale } from "../../../utils/localized-response"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const productTemplates = resolveStorefrontProductTemplateApplication()
  const templates = await productTemplates.listProductTemplates({
    locale: resolveRequestLocale(req),
  })

  res.json({
    templates,
  })
}
