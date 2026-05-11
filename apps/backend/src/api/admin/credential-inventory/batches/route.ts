import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import CredentialInventoryModuleService from "../../../../modules/credential-inventory/service"
import { CREDENTIAL_INVENTORY_MODULE } from "../../../../modules/credential-inventory"
import type { CreateCredentialBatchInput } from "../../../../modules/credential-inventory/types"
import { resolveProductTemplate } from "../../../../platform/product-templates"

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
  const inventory: CredentialInventoryModuleService = req.scope.resolve(
    CREDENTIAL_INVENTORY_MODULE
  )

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
  if (!req.body.name || !req.body.product_variant_id) {
    res.status(400).json({
      message: "name and product_variant_id are required",
    })
    return
  }

  if (!req.body.items?.length) {
    res.status(400).json({
      message: "items must include at least one credential",
    })
    return
  }

  const missingCredential = req.body.items.some(
    (item) => typeof item.credential === "undefined"
  )

  if (missingCredential) {
    res.status(400).json({
      message: "Each item requires credential",
    })
    return
  }

  const inventory: CredentialInventoryModuleService = req.scope.resolve(
    CREDENTIAL_INVENTORY_MODULE
  )
  const productTemplate = resolveProductTemplate({
    code: req.body.template_code,
    metadata: req.body.metadata || null,
  })

  if (req.body.template_code && !productTemplate) {
    res.status(400).json({
      message: `Unknown template_code: ${req.body.template_code}`,
    })
    return
  }

  const input: CreateCredentialBatchInput = {
    name: req.body.name,
    productVariantId: req.body.product_variant_id,
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
