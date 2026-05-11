import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { resolveProductFulfillmentPolicy } from "../../../platform/delivery"
import {
  getInventoryHandler,
  type InventoryAvailability,
} from "../../../platform/inventory"
import { resolveProductTemplate } from "../../../platform/product-templates"

type VariantInventoryContext = {
  variantId: string
  productType: string | null
  handlerCode: string
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = (req.validatedQuery || req.query) as {
    variant_ids?: string | string[]
  }
  const variantIds = toVariantIds(query.variant_ids)

  if (!variantIds.length) {
    res.json({
      availability: [],
    })
    return
  }

  const variantContexts = await resolveVariantInventoryContexts(req, variantIds)
  const availabilityByVariantId = new Map<string, InventoryAvailability>()
  const handlerToVariantIds = new Map<string, Set<string>>()

  for (const context of variantContexts) {
    const variantIdSet = handlerToVariantIds.get(context.handlerCode) || new Set<string>()
    variantIdSet.add(context.variantId)
    handlerToVariantIds.set(context.handlerCode, variantIdSet)
  }

  await Promise.all(
    Array.from(handlerToVariantIds.entries()).map(
      async ([handlerCode, handlerVariantIds]) => {
        const handler = getInventoryHandler(handlerCode)

        if (!handler?.listAvailability) {
          return
        }

        const availability = await handler.listAvailability({
          scope: req.scope,
          variantIds: Array.from(handlerVariantIds),
        })

        for (const item of availability) {
          availabilityByVariantId.set(item.variant_id, item)
        }
      }
    )
  )

  const availability = variantContexts.map((context) => {
    return (
      availabilityByVariantId.get(context.variantId) || {
        variant_id: context.variantId,
        total_count: 0,
        available_count: 0,
        reserved_count: 0,
        sold_count: 0,
        locked_count: 0,
        is_in_stock: false,
      }
    )
  })

  res.json({
    availability,
  })
}

async function resolveVariantInventoryContexts(
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

  let rows: Array<Record<string, unknown>> = []

  try {
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

    rows = result.data || []
  } catch {
    // Fall through to conservative defaults when query graph data is unavailable.
  }

  const byId = new Map<string, Record<string, unknown>>(
    rows
      .map((row) => [toOptionalString(row.id), row] as const)
      .filter((entry): entry is [string, Record<string, unknown>] => Boolean(entry[0]))
  )
  return Promise.all(
    variantIds.map(async (variantId) => {
      const row = byId.get(variantId)
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
        plan?.inventoryHandlerCode ||
        "credential-inventory"

      return {
        variantId,
        productType: productType || template?.productType || null,
        handlerCode,
      }
    })
  )
}

function toVariantIds(value: unknown) {
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
