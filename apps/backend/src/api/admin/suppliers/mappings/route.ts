import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { hasSupplierProvider } from "../../../../platform/supplier"
import { resolveSupplierProcurementService } from "../../../../platform-adapters/services"
import { localizedError } from "../../../../utils/localized-response"

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
  const body = (req.validatedBody || req.body) as UpsertMappingBody
  const productVariantId = toOptionalText(body.product_variant_id)
  const providerCode = toOptionalText(body.provider_code)
  const providerSku = toOptionalText(body.provider_sku)

  if (!productVariantId || !providerCode || !providerSku) {
    localizedError(req, res, 400, "supplier.mappingRequired")
    return
  }

  if (!hasSupplierProvider(providerCode)) {
    localizedError(req, res, 400, "supplier.providerNotRegistered", {
      providerCode,
    })
    return
  }

  const procurement = resolveSupplierProcurementService(req.scope)
  const mapping = await procurement.upsertProductMapping({
    productVariantId,
    providerCode,
    providerSku,
    providerProductId: body.provider_product_id,
    providerVariantId: body.provider_variant_id,
    regionCode: body.region_code,
    currency: body.currency,
    enabled: body.enabled,
    priority: body.priority,
    costPrice: body.cost_price,
    listPrice: body.list_price,
    metadata: body.metadata,
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
