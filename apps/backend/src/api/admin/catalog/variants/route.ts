import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveRequestLocale } from "../../../../utils/localized-response"
import { listAdminCatalogVariants } from "./catalog-variant-query"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const variants = await listAdminCatalogVariants({
    scope: req.scope,
    queryParams: (req.validatedQuery || req.query) as Record<string, unknown>,
    locale: resolveRequestLocale(req),
  })

  res.json({
    variants,
  })
}
