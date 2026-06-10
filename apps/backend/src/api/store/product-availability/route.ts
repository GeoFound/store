import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import {
  getInventoryHandler,
  type InventoryAvailability,
} from "../../../platform/inventory"
import { createInventoryHandlerScope } from "../../../platform-adapters/backend-context"
import {
  resolveVariantInventoryContexts,
  toVariantIds,
} from "../product-availability-query"
import {
  getCheckoutPolicy,
  hasSupplierBackorderPath,
} from "../../../platform-adapters/checkout-policy"

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
  const checkoutPolicy = getCheckoutPolicy()
  const inventoryScope = createInventoryHandlerScope(req.scope)
  const availabilityByVariantId = new Map<string, InventoryAvailability>()
  const handlerToVariantIds = new Map<string, Set<string>>()

  for (const context of variantContexts) {
    if (context.handlerCode === "noop") {
      continue
    }

    const variantIdSet = handlerToVariantIds.get(context.handlerCode) || new Set<string>()
    variantIdSet.add(context.variantId)
    handlerToVariantIds.set(context.handlerCode, variantIdSet)
  }

  await Promise.all(
    Array.from(handlerToVariantIds.entries()).map(
      async ([handlerCode, handlerVariantIds]) => {
        const handler = getInventoryHandler(handlerCode)

        if (!handler) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `Inventory handler ${handlerCode} is not registered`
          )
        }

        if (!handler.listAvailability) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `Inventory handler ${handlerCode} cannot list availability`
          )
        }

        const availability = await handler.listAvailability({
          scope: inventoryScope,
          variantIds: Array.from(handlerVariantIds),
        })

        for (const item of availability) {
          availabilityByVariantId.set(item.variant_id, item)
        }
      }
    )
  )

  const availability = await Promise.all(
    variantContexts.map(async (context) => {
      if (context.handlerCode === "noop") {
        return {
          variant_id: context.variantId,
          total_count: 0,
          available_count: Number.MAX_SAFE_INTEGER,
          reserved_count: 0,
          sold_count: 0,
          locked_count: 0,
          is_in_stock: true,
          purchase_available: true,
          backorderable: false,
          availability_policy: "no_inventory",
        }
      }

      const base =
        availabilityByVariantId.get(context.variantId) || {
          variant_id: context.variantId,
          total_count: 0,
          available_count: 0,
          reserved_count: 0,
          sold_count: 0,
          locked_count: 0,
          is_in_stock: false,
        }

      const canUseSupplierBackorder =
        checkoutPolicy.outOfStockPolicy === "allow_supplier_backorder" &&
        !base.is_in_stock
          ? await hasSupplierBackorderPath({
              scope: req.scope,
              productVariantId: context.variantId,
              metadata: context.metadata,
            })
          : false

      if (canUseSupplierBackorder) {
        return {
          ...base,
          is_in_stock: true,
          purchase_available: true,
          backorderable: true,
          availability_policy: "allow_supplier_backorder",
        }
      }

      return {
        ...base,
        purchase_available: base.is_in_stock,
        backorderable: false,
        availability_policy: "inventory",
      }
    })
  )

  res.json({
    availability,
  })
}
