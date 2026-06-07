import type { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { resolveProductFulfillmentPolicy } from "../../../../platform/delivery"
import { resolveProductTemplate } from "../../../../platform/product-templates"

type QueryGraph = {
  graph: (input: {
    entity: string
    fields: string[]
    filters: Record<string, unknown>
  }) => Promise<{ data?: Array<Record<string, unknown>> }>
}

export async function resolveCredentialInventoryImportTarget(
  scope: MedusaRequest["scope"],
  productVariantId: string
) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY) as QueryGraph
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
      id: productVariantId,
    },
  })
  const row = result.data?.[0]

  if (!row) {
    return {
      exists: false,
      handlerCode: "missing",
    }
  }

  const variantMetadata = normalizeRecord(row.metadata)
  const product = normalizeRecord(row.product)
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

  if (!template) {
    return {
      exists: true,
      handlerCode: "unknown-template",
    }
  }

  const plan = await resolveProductFulfillmentPolicy({
    code:
      toOptionalString(metadata.fulfillment_policy_code) ||
      toOptionalString(metadata.fulfillmentPolicyCode) ||
      template.fulfillmentPolicyCode,
    productVariantId,
    productType: productType || template.productType || null,
    metadata: {
      template_code: template.code,
      product_type: template.productType || productType || null,
      product_variant_id: productVariantId,
      ...metadata,
    },
  })

  return {
    exists: true,
    handlerCode:
      toOptionalString(metadata.inventory_handler_code) ||
      toOptionalString(metadata.inventoryHandlerCode) ||
      (plan?.inventoryMode === "none" ? "noop" : "") ||
      template.inventoryHandlerCode ||
      plan?.inventoryHandlerCode ||
      "unconfigured",
  }
}

function normalizeRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}
