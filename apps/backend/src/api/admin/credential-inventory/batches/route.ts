import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { CreateCredentialBatchInput } from "../../../../platform/credential-inventory"
import { resolveProductTemplate } from "../../../../platform/product-templates"
import { resolveCredentialInventoryService } from "../../../../platform-adapters/services"
import { localizedError } from "../../../../utils/localized-response"
import { resolveCredentialInventoryImportTarget } from "./import-target"

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
  const body = (req.validatedBody || req.body) as CreateBatchBody
  const productVariantId = body.product_variant_id

  if (!body.name || !productVariantId) {
    localizedError(req, res, 400, "credentialBatch.required")
    return
  }

  if (!body.items?.length) {
    localizedError(req, res, 400, "credentialBatch.itemsRequired")
    return
  }

  const missingCredential = body.items.some(
    (item) => typeof item.credential === "undefined"
  )

  if (missingCredential) {
    localizedError(req, res, 400, "credentialBatch.itemCredentialRequired")
    return
  }

  const importTarget = await resolveCredentialInventoryImportTarget(
    req.scope,
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
    code: body.template_code,
    metadata: body.metadata || null,
  })

  if (body.template_code && !productTemplate) {
    localizedError(req, res, 400, "template.unknown", {
      templateCode: body.template_code,
    })
    return
  }

  const input: CreateCredentialBatchInput = {
    name: body.name,
    productVariantId,
    sourceNote: body.source_note,
    costPrice: body.cost_price,
    currency: body.currency,
    metadata: {
      template_code: productTemplate?.code || null,
      product_type: productTemplate?.productType || null,
      fulfillment_policy_code: productTemplate?.fulfillmentPolicyCode || null,
      delivery_handler_code: productTemplate?.deliveryHandlerCode || null,
      inventory_handler_code: productTemplate?.inventoryHandlerCode || null,
      ...(body.metadata || {}),
    },
    items: body.items.map((item) => ({
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
