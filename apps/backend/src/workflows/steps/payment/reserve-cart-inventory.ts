import {
  createStep,
  StepResponse,
} from "@medusajs/framework/workflows-sdk"
import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { resolveProductFulfillmentPolicy } from "../../../platform/delivery"
import { emitPaymentAttemptReservedEvent } from "../../../platform/events"
import { ensurePlatformIntegrationsRegistered } from "../../../platform-adapters/integrations"
import { handlePaymentAttemptClosed } from "../../../platform/attempt-lifecycle"
import {
  getCartItemMetadata,
  getCartItemProductType,
  getCartItemVariantId,
  getInventoryHandler,
  normalizeFulfillmentQuantity,
  type FulfillmentCartItem,
  type InventoryReservation,
} from "../../../platform/inventory"
import { resolveProductTemplate } from "../../../platform/product-templates"
import { resolvePaymentRouterService } from "../../../platform-adapters/services"
import {
  attachClaimToken,
  type FulfillmentItemSummary,
} from "../../../utils/payment-attempt"
import { createTokenWithPrefix } from "../../../utils/token"
import { releaseInventoryReservations } from "./inventory-reservation-cleanup"

export type ReserveCartInventoryStepInput = {
  cartId: string
  attemptId: string
  items: FulfillmentCartItem[]
  attemptResponsePayload?: Record<string, unknown> | null
}

export const reserveCartInventoryStep = createStep(
  "reserve-cart-inventory",
  async (
    input: ReserveCartInventoryStepInput,
    { container }: { container: MedusaContainer }
  ) => {
    ensurePlatformIntegrationsRegistered()

    const paymentRouter = resolvePaymentRouterService(container)
    const reservations: InventoryReservation[] = []
    const fulfillmentItems: FulfillmentItemSummary[] = []

    try {
      for (const rawItem of input.items) {
        const variantId = getCartItemVariantId(rawItem)
        const quantity = normalizeFulfillmentQuantity(rawItem.quantity) || 1
        const itemId = typeof rawItem.id === "string" ? rawItem.id : variantId
        const fulfillmentKey = `payment_attempt:${input.attemptId}:${itemId}`
        const reservationKey = fulfillmentKey
        const metadata = getCartItemMetadata(rawItem)
        const productType = getCartItemProductType(rawItem)
        const template = resolveProductTemplate({
          productType,
          metadata,
        })
        const explicitTemplateCode =
          toOptionalString(metadata.template_code) ||
          toOptionalString(metadata.templateCode) ||
          toOptionalString(metadata.product_template) ||
          toOptionalString(metadata.productTemplate)

        if (explicitTemplateCode && !template) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `Unknown product template code "${explicitTemplateCode}" for variant ${variantId}`
          )
        }

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

        if (plan?.inventoryMode === "none") {
          const deliveryHandlerCode = requireConfiguredCode(
            plan.deliveryHandlerCode,
            `No delivery handler configured for no-inventory variant ${variantId}`
          )

          if (deliveryHandlerCode === "noop") {
            throw new Error(
              `Delivery handler "noop" cannot fulfill no-inventory variant ${variantId}`
            )
          }

          fulfillmentItems.push({
            fulfillment_key: fulfillmentKey,
            cart_item_id: itemId,
            product_variant_id: variantId,
            quantity,
            inventory_mode: "none",
            inventory_handler_code: plan.inventoryHandlerCode || "noop",
            delivery_handler_code: deliveryHandlerCode,
            fulfillment_policy_code: plan.code || null,
            product_type: productType || template?.productType || null,
            template_code: template?.code || null,
            metadata: {
              template_code: template?.code || null,
              product_type: template?.productType || productType || null,
              product_variant_id: variantId,
              cart_item_id: itemId,
              fulfillment_key: fulfillmentKey,
              fulfillment_policy_code: plan.code || null,
              delivery_handler_code: deliveryHandlerCode,
              inventory_handler_code: plan.inventoryHandlerCode || "noop",
              ...metadata,
            },
          })
          continue
        }

        const handlerCode = requireConfiguredCode(
          toOptionalString(metadata.inventory_handler_code) ||
            toOptionalString(metadata.inventoryHandlerCode) ||
            plan?.inventoryHandlerCode,
          `No inventory handler configured for variant ${variantId}`
        )

        const handler = getInventoryHandler(handlerCode, {
          productTypeCode: productType || template?.productType || undefined,
        })

        if (!handler) {
          throw new Error(`Inventory handler ${handlerCode} is not registered`)
        }

        const reservationMetadata = {
          template_code: template?.code || null,
          product_type: template?.productType || productType || null,
          product_variant_id: variantId,
          fulfillment_policy_code: plan?.code || null,
          delivery_handler_code: plan?.deliveryHandlerCode || null,
          inventory_handler_code: handler.code,
          ...metadata,
        }

        const reserved = await handler.reserve({
          scope: container,
          cartId: input.cartId,
          attemptId: input.attemptId,
          item: rawItem,
          productVariantId: variantId,
          quantity,
          reservationKey,
          metadata: reservationMetadata,
        })

        reservations.push(
          ...reserved.map((reservation) => ({
            ...reservation,
            handler_code: requireConfiguredCode(
              reservation.handler_code,
              `Inventory handler ${handler.code} returned a reservation without handler_code for variant ${variantId}`
            ),
            metadata: {
              cart_item_id: itemId,
              fulfillment_key: fulfillmentKey,
              ...(reservation.metadata || {}),
            },
          }))
        )
        fulfillmentItems.push({
          fulfillment_key: fulfillmentKey,
          cart_item_id: itemId,
          product_variant_id: variantId,
          quantity,
          inventory_mode: plan?.inventoryMode || "reserve",
          inventory_handler_code: handler.code,
          delivery_handler_code: requireConfiguredCode(
            plan?.deliveryHandlerCode,
            `No delivery handler configured for variant ${variantId}`
          ),
          fulfillment_policy_code: plan?.code || null,
          product_type: productType || template?.productType || null,
          template_code: template?.code || null,
          reservation_keys: reserved.map((reservation) => reservation.reservation_key),
          metadata: {
            ...reservationMetadata,
            cart_item_id: itemId,
            fulfillment_key: fulfillmentKey,
          },
        })
      }

      const claimToken = createTokenWithPrefix("claim")
      const responsePayload = attachClaimToken(
        {
          ...(input.attemptResponsePayload || {}),
          inventory_reservations: reservations,
          fulfillment_items: fulfillmentItems,
        },
        claimToken
      )

      const attempt = await paymentRouter.updatePaymentAttempts({
        id: input.attemptId,
        response_payload: responsePayload,
      })

      try {
        await emitPaymentAttemptReservedEvent(container, {
          attempt,
          inventoryReservations: reservations,
          fulfillmentItems,
          claimToken,
          responsePayload,
        })
      } catch {
        // Hook consumers must not break the payment flow.
      }

      return new StepResponse({
        attempt,
        inventoryReservations: reservations,
        fulfillmentItems,
        claimToken,
        responsePayload,
      })
    } catch (err) {
      await releaseInventoryReservations(container, reservations)

      const failedAttempt = await paymentRouter.markAttemptFailed({
        id: input.attemptId,
        errorMessage:
          err instanceof Error ? err.message : "Failed to reserve inventory",
        callbackPayload: {
          source: "inventory_reservation",
        },
      })

      try {
        await handlePaymentAttemptClosed(container, {
          attemptId: input.attemptId,
          customerEmail:
            typeof failedAttempt.request_payload === "object" &&
            failedAttempt.request_payload &&
            typeof (failedAttempt.request_payload as Record<string, unknown>)
              .customer_email === "string"
              ? String(
                  (failedAttempt.request_payload as Record<string, unknown>)
                    .customer_email
                )
              : null,
          reason: "inventory_reservation_failed",
          payload:
            (failedAttempt.response_payload as Record<string, unknown> | null) ||
            (input.attemptResponsePayload || null),
        })
      } catch {
        // Marketing close handlers are best-effort and must not shadow the original error.
      }

      throw err
    }
  }
)

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function requireConfiguredCode(value: unknown, message: string) {
  const code = toOptionalString(value)

  if (!code) {
    throw new Error(message)
  }

  return code
}
