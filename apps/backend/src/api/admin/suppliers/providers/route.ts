import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listSupplierProviders } from "../../../../platform/supplier"

export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  const providers = listSupplierProviders().map((provider) => ({
    code: provider.code,
    configured: provider.isConfigured?.() ?? true,
    supports_quote: Boolean(provider.quote),
    supports_retrieve: Boolean(provider.retrieveFulfillment),
    supports_catalog_sync: Boolean(provider.syncCatalog),
  }))

  res.json({
    providers,
  })
}
