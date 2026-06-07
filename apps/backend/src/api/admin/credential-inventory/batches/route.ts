import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { CreateCredentialBatchInput } from "../../../../modules/credential-inventory/types"
import { resolveProductFulfillmentPolicy } from "../../../../platform/delivery"
import { resolveProductTemplate } from "../../../../platform/product-templates"
import { resolveCredentialInventoryService } from "../../../../platform-adapters/services"
import { localizedError } from "../../../../utils/localized-response"

type CreateBatchBody = {
  name?: string
  product_variant_id?: string
  template_code?: string
  source_note?: string
  cost_price?: number
  currency?: string
  metadata?: Record<string, unknown>
  items?: Array<{
    credential?: Record<string, unknown> | string
    account_identifier?: string
    display_label?: string
    source_note?: string
    cost_price?: number
    currency?: string
    metadata?: Record<string, unknown>
  }>
}

type QueryGraph = {
  graph: (input: {
    entity: string
    fields: string[]
    filters: Record<string, unknown>
  }) => Promise<{ data?: Array<Record<string, unknown>> }>
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const inventory = resolveCredentialInventoryService(req.scope)

  const batches = await inventory.listAccountBatches(
    {},
    {
      take: 50,
      order: {
        created_at: "DESC",
      },
    }
  )

  res.json({
    batches,
  })
}

export const POST = async (
  req: MedusaRequest<CreateBatchBody>,
  res: MedusaResponse
) => {
  const productVariantId = req.body.product_variant_id

  if (!req.body.name || !productVariantId) {
    localizedError(req, res, 400, "credentialBatch.required")
    return
  }

  if (!req.body.items?.length) {
    localizedError(req, res, 400, "credentialBatch.itemsRequired")
    return
  }

  const missingCredential = req.body.items.some(
    (item) => typeof item.credential === "undefined"
  )

  if (missingCredential) {
    localizedError(req, res, 400, "credentialBatch.itemCredentialRequired")
    return
  }

  const importTarget = await resolveCredentialInventoryImportTarget(
    req,
    productVariantId
  )

  if (!importTarget.exists) {
    localizedError(req, res, 404, "credentialBatch.variantNotFound", {
      variantId: productVariantId,
    })
    return
  }

  if (importTarget.handlerCode !== "credential-inventory") {
    localizedError(req, res, 400, "credentialBatch.unsupportedVariant", {
      variantId: productVariantId,
      handlerCode: importTarget.handlerCode,
    })
    return
  }

  const inventory = resolveCredentialInventoryService(req.scope)
  const productTemplate = resolveProductTemplate({
    code: req.body.template_code,
    metadata: req.body.metadata || null,
  })

  if (req.body.template_code && !productTemplate) {
    localizedError(req, res, 400, "template.unknown", {
      templateCode: req.body.template_code,
    })
    return
  }

  const input: CreateCredentialBatchInput = {
    name: req.body.name,
    productVariantId,
    sourceNote: req.body.source_note,
    costPrice: req.body.cost_price,
    currency: req.body.currency,
    metadata: {
      template_code: productTemplate?.code || null,
      product_type: productTemplate?.productType || null,
      fulfillment_policy_code: productTemplate?.fulfillmentPolicyCode || null,
      delivery_handler_code: productTemplate?.deliveryHandlerCode || null,
      inventory_handler_code: productTemplate?.inventoryHandlerCode || null,
      ...(req.body.metadata || {}),
    },
    items: req.body.items.map((item) => ({
      credential: item.credential as Record<string, unknown> | string,
      accountIdentifier: item.account_identifier,
      displayLabel: item.display_label,
      sourceNote: item.source_note,
      costPrice: item.cost_price,
      currency: item.currency,
      metadata: {
        template_code: productTemplate?.code || null,
        product_type: productTemplate?.productType || null,
        fulfillment_policy_code: productTemplate?.fulfillmentPolicyCode || null,
        delivery_handler_code: productTemplate?.deliveryHandlerCode || null,
        inventory_handler_code: productTemplate?.inventoryHandlerCode || null,
        ...(item.metadata || {}),
      },
    })),
  }

  const result = await inventory.createCredentialBatch(input)

  res.status(201).json(result)
}

async function resolveCredentialInventoryImportTarget(
  req: MedusaRequest,
  productVariantId: string
) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as QueryGraph
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
