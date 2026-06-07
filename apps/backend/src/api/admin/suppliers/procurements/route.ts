import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveSupplierProcurementService } from "../../../../platform-adapters/services"
import type { SupplierProcurementStatus } from "../../../../platform/supplier-procurement"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = (req.validatedQuery || req.query) as {
    status?: SupplierProcurementStatus
    provider_code?: string
    product_variant_id?: string
    order_id?: string
    payment_attempt_id?: string
    limit?: string
  }
  const procurement = resolveSupplierProcurementService(req.scope)
  const procurements = await procurement.listProcurementsSafe({
    status: query.status,
    providerCode: toOptionalText(query.provider_code),
    productVariantId: toOptionalText(query.product_variant_id),
    orderId: toOptionalText(query.order_id),
    paymentAttemptId: toOptionalText(query.payment_attempt_id),
    limit: toNumber(query.limit),
  })

  res.json({
    procurements,
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
