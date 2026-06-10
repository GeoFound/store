import type { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { resolveProductFulfillmentPolicy } from "../../platform/delivery"
import { resolveProductTemplate } from "../../platform/product-templates"

export type VariantInventoryContext = {
  variantId: string
  productType: string | null
  handlerCode: string
  metadata: Record<string, unknown>
}

export async function resolveVariantInventoryContexts(
  req: MedusaRequest,
  variantIds: string[]
) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (input: {
      entity: string
      fields: string[]
      filters: Record<string, unknown>
    }) => Promise<{ data?: Array<Record<string, unknown>> }>
  }

  const result = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "metadata",
      "product.id",
      "product.type.value",
      "product.metadata",
    ],
    filters: {
      id: variantIds,
    },
  })
  const rows = result.data || []

  const byId = new Map<string, Record<string, unknown>>(
    rows
      .map((row) => [toOptionalString(row.id), row] as const)
      .filter((entry): entry is [string, Record<string, unknown>] => Boolean(entry[0]))
  )
  return Promise.all(
    variantIds.map(async (variantId) => {
      const row = byId.get(variantId)

      if (!row) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `Product variant ${variantId} was not found`
        )
      }

      const variantMetadata = normalizeRecord(row?.metadata)
      const product = normalizeRecord(row?.product)
      const productMetadata = normalizeRecord(product.metadata)
      const metadata = {
        ...productMetadata,
        ...variantMetadata,
      }
      const productType =
        toOptionalString(normalizeRecord(product.type).value) ||
        toOptionalString(metadata.product_type) ||
        toOptionalString(metadata.productType) ||
        null
      const template = resolveProductTemplate({
        productType,
        metadata,
      })
      const plan = await resolveProductFulfillmentPolicy({
        code:
          toOptionalString(metadata.fulfillment_policy_code) ||
          toOptionalString(metadata.fulfillmentPolicyCode) ||
          template?.fulfillmentPolicyCode,
        productVariantId: variantId,
        productType: productType || template?.productType || null,
        metadata: {
          template_code: template?.code || null,
          product_type: template?.productType || productType || null,
          product_variant_id: variantId,
          ...metadata,
        },
      })

      const handlerCode =
        toOptionalString(metadata.inventory_handler_code) ||
        toOptionalString(metadata.inventoryHandlerCode) ||
        (plan?.inventoryMode === "none" ? "noop" : "") ||
        template?.inventoryHandlerCode ||
        plan?.inventoryHandlerCode

      if (!handlerCode) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `No inventory handler configured for variant ${variantId}`
        )
      }

      return {
        variantId,
        productType: productType || template?.productType || null,
        handlerCode,
        metadata,
      }
    })
  )
}

export function toVariantIds(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => String(entry).split(","))
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  return []
}

function normalizeRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}
