import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { hasSupplierProvider } from "../../../../platform/supplier"
import { resolveSupplierProcurementService } from "../../../../platform/services"

type UpsertMappingBody = {
  product_variant_id?: string
  provider_code?: string
  provider_sku?: string
  provider_product_id?: string | null
  provider_variant_id?: string | null
  region_code?: string | null
  currency?: string | null
  enabled?: boolean
  priority?: number
  cost_price?: number | null
  list_price?: number | null
  metadata?: Record<string, unknown> | null
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = (req.validatedQuery || req.query) as {
    product_variant_id?: string
    provider_code?: string
    enabled?: string
    limit?: string
  }
  const procurement = resolveSupplierProcurementService(req.scope)
  const mappings = await procurement.listMappingsSafe({
    productVariantId: toOptionalText(query.product_variant_id),
    providerCode: toOptionalText(query.provider_code),
    enabled:
      typeof query.enabled === "string" ? query.enabled === "true" : undefined,
    limit: toNumber(query.limit),
  })

  res.json({
    mappings,
  })
}

export const POST = async (
  req: MedusaRequest<UpsertMappingBody>,
  res: MedusaResponse
) => {
  const productVariantId = toOptionalText(req.body.product_variant_id)
  const providerCode = toOptionalText(req.body.provider_code)
  const providerSku = toOptionalText(req.body.provider_sku)

  if (!productVariantId || !providerCode || !providerSku) {
    res.status(400).json({
      message: "product_variant_id, provider_code, and provider_sku are required",
    })
    return
  }

  if (!hasSupplierProvider(providerCode)) {
    res.status(400).json({
      message: `Supplier provider ${providerCode} is not registered`,
    })
    return
  }

  const procurement = resolveSupplierProcurementService(req.scope)
  const mapping = await procurement.upsertProductMapping({
    productVariantId,
    providerCode,
    providerSku,
    providerProductId: req.body.provider_product_id,
    providerVariantId: req.body.provider_variant_id,
    regionCode: req.body.region_code,
    currency: req.body.currency,
    enabled: req.body.enabled,
    priority: req.body.priority,
    costPrice: req.body.cost_price,
    listPrice: req.body.list_price,
    metadata: req.body.metadata,
  })

  res.status(201).json({
    mapping,
  })
}

function toOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function toNumber(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}
