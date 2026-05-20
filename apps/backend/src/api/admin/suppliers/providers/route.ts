import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listSupplierProviders } from "../../../../platform/supplier"
import { getG2aConfig } from "../../../../modules/supplier-g2a/config"
import { getReloadlyConfig } from "../../../../modules/supplier-reloadly/config"

export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  const providers = listSupplierProviders().map((provider) => ({
    code: provider.code,
    configured: isProviderConfigured(provider.code),
    supports_quote: Boolean(provider.quote),
    supports_retrieve: Boolean(provider.retrieveFulfillment),
    supports_catalog_sync: Boolean(provider.syncCatalog),
  }))

  res.json({
    providers,
  })
}

function isProviderConfigured(code: string) {
  if (code === "reloadly") {
    return getReloadlyConfig().configured
  }

  if (code === "g2a") {
    return getG2aConfig().configured
  }

  return true
}
