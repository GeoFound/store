import type { MedusaContainer } from "@medusajs/framework/types"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { ensureCartOrder } from "../../../utils/ensure-cart-order"
import {
  extractFulfillmentItems,
  extractInventoryReservations,
  isPaymentAttemptFinalized,
  markPaymentAttemptFinalizationFailed,
  markPaymentAttemptFinalized,
  markPaymentAttemptFinalizing,
} from "../../../utils/payment-attempt"
import {
  emitDeliveryCompletedEvent,
  emitDeliveryCreatedEvent,
  emitPaymentAttemptFinalizedEvent,
} from "../../../platform/events"
import { getDeliveryHandler } from "../../../platform/delivery"
import { getInventoryHandler } from "../../../platform/inventory"
import { getOrderAccessProvider } from "../../../platform/order-access"
import { ensurePlatformIntegrationsRegistered } from "../../../platform-adapters/integrations"
import { resolvePaymentRouterService } from "../../../platform-adapters/services"

export type FinalizePaymentAttemptStepInput =
  | {
      attemptId: string
      callbackPayload?: Record<string, unknown> | null
    }
  | {
      providerOrderId: string
      providerCode?: string
      callbackPayload?: Record<string, unknown> | null
    }

export const finalizePaymentAttemptStep = createStep(
  "finalize-payment-attempt",
  async (
    input: FinalizePaymentAttemptStepInput,
    { container }: { container: MedusaContainer }
  ) => {
    ensurePlatformIntegrationsRegistered()

    const paymentRouter = resolvePaymentRouterService(container)
    const locking = container.resolve(Modules.LOCKING)

    const currentAttempt =
      "attemptId" in input
        ? await paymentRouter.retrievePaymentAttempt(input.attemptId)
        : await paymentRouter.retrievePaymentAttemptByProviderOrderId({
            providerOrderId: input.providerOrderId,
            providerCode: input.providerCode,
          })

    const result = await locking.execute(
      [
        `payment_attempt:${currentAttempt.id}`,
        ...(currentAttempt.cart_id ? [`cart:${currentAttempt.cart_id}`] : []),
      ],
      async () => {
        const lockedAttempt = await paymentRouter.retrievePaymentAttempt(
          currentAttempt.id
        )

        if (
          lockedAttempt.status === "paid" &&
          lockedAttempt.order_id &&
          isPaymentAttemptFinalized(lockedAttempt.response_payload)
        ) {
          return {
            attempt: lockedAttempt,
            order_id: String(lockedAttempt.order_id),
          }
        }

        const attempt =
          lockedAttempt.status === "paid"
            ? lockedAttempt
            : "attemptId" in input
              ? await paymentRouter.markAttemptPaid({
                  id: input.attemptId,
                  callbackPayload: input.callbackPayload || undefined,
                })
              : await paymentRouter.markAttemptPaidByProviderOrderId({
                  providerOrderId: input.providerOrderId,
                  providerCode: input.providerCode,
                  callbackPayload: input.callbackPayload || undefined,
                })

        let updatedAttempt = attempt

        try {
          updatedAttempt = await paymentRouter.updatePaymentAttempts({
            id: updatedAttempt.id,
            response_payload: markPaymentAttemptFinalizing(
              updatedAttempt.response_payload
            ),
          })

          const order = await ensureCartOrder(container, {
            cartId: String(attempt.cart_id),
            orderId: attempt.order_id,
            transactionReferenceId: attempt.id,
          })

          if (updatedAttempt.order_id !== order.id) {
            updatedAttempt = await paymentRouter.updatePaymentAttempts({
              id: updatedAttempt.id,
              order_id: order.id,
            })
          }

          if (updatedAttempt.cart_id) {
            const cartModuleService = container.resolve(Modules.CART)
            await cartModuleService.updateCarts(updatedAttempt.cart_id, {
              completed_at: new Date(),
            })
          }

          for (const reservation of extractInventoryReservations(
            updatedAttempt.response_payload
          )) {
            const handlerCode = requireConfiguredCode(
              reservation.handler_code,
              `Inventory reservation ${reservation.reservation_key} is missing handler_code`
            )
            const handler = getInventoryHandler(handlerCode)

            if (!handler) {
              throw new Error(`Inventory handler ${handlerCode} is not registered`)
            }

            await handler.finalizeReservation({
              scope: container,
              reservation: {
                ...reservation,
                handler_code: handlerCode,
              },
              orderId: order.id,
            })

            for (const accountItemId of reservation.item_ids) {
              const deliveryMetadata = normalizeRecord(reservation.metadata)
              const deliveryHandlerCode = requireConfiguredCode(
                toOptionalString(deliveryMetadata.delivery_handler_code) ||
                  toOptionalString(deliveryMetadata.deliveryHandlerCode),
                `Inventory reservation ${reservation.reservation_key} is missing delivery handler metadata`
              )
              const deliveryHandler = getDeliveryHandler(deliveryHandlerCode)

              if (!deliveryHandler) {
                throw new Error(
                  `Delivery handler ${deliveryHandlerCode} is not registered`
                )
              }

              const deliveryResult = await deliveryHandler.createDelivery({
                scope: container,
                orderId: order.id,
                cartId: updatedAttempt.cart_id || undefined,
                paymentAttemptId: updatedAttempt.id,
                orderItemId:
                  toOptionalString(deliveryMetadata.cart_item_id) || undefined,
                accountItemId,
                inventoryReservation: {
                  ...reservation,
                  handler_code: handlerCode,
                },
                productVariantId:
                  toOptionalString(deliveryMetadata.product_variant_id) ||
                  undefined,
                productType:
                  toOptionalString(deliveryMetadata.product_type) || null,
                deliveryHandlerCode,
                deliveryStatus: "delivered",
                deliveredBy: "system",
                metadata: {
                  source: "payment_finalize",
                  ...deliveryMetadata,
                },
              })

              await emitDeliveryCreated(container, {
                delivery: deliveryResult.delivery,
                accessToken: deliveryResult.accessToken,
                created: deliveryResult.created,
                updated: deliveryResult.updated,
                orderId: order.id,
                metadata: {
                  source: "payment_finalize",
                  ...deliveryMetadata,
                },
              })
            }
          }

          for (const fulfillmentItem of extractFulfillmentItems(
            updatedAttempt.response_payload
          )) {
            if (fulfillmentItem.inventory_mode !== "none") {
              continue
            }

            const deliveryMetadata = {
              ...(fulfillmentItem.metadata || {}),
              fulfillment_key: fulfillmentItem.fulfillment_key,
              cart_item_id:
                fulfillmentItem.cart_item_id ||
                fulfillmentItem.fulfillment_key,
              product_variant_id: fulfillmentItem.product_variant_id,
              product_type: fulfillmentItem.product_type || null,
              template_code: fulfillmentItem.template_code || null,
              fulfillment_policy_code:
                fulfillmentItem.fulfillment_policy_code || null,
              delivery_handler_code: fulfillmentItem.delivery_handler_code,
              inventory_handler_code:
                fulfillmentItem.inventory_handler_code || null,
              quantity: fulfillmentItem.quantity,
            }
            const deliveryHandlerCode =
              toOptionalString(deliveryMetadata.delivery_handler_code) ||
              toOptionalString(deliveryMetadata["deliveryHandlerCode"]) ||
              fulfillmentItem.delivery_handler_code

            if (!deliveryHandlerCode || deliveryHandlerCode === "noop") {
              throw new Error(
                `No delivery handler configured for fulfillment item ${fulfillmentItem.fulfillment_key}`
              )
            }

            const deliveryHandler = getDeliveryHandler(deliveryHandlerCode)

            if (!deliveryHandler) {
              throw new Error(
                `Delivery handler ${deliveryHandlerCode} is not registered`
              )
            }

            const inlinePayload = resolveInlineDeliveryPayload(deliveryMetadata)
            const deliveryResult = await deliveryHandler.createDelivery({
              scope: container,
              orderId: order.id,
              cartId: updatedAttempt.cart_id || undefined,
              paymentAttemptId: updatedAttempt.id,
              orderItemId:
                fulfillmentItem.cart_item_id ||
                fulfillmentItem.fulfillment_key,
              accountItemId: null,
              productVariantId:
                fulfillmentItem.product_variant_id ||
                toOptionalString(deliveryMetadata.product_variant_id) ||
                undefined,
              productType:
                fulfillmentItem.product_type ||
                toOptionalString(deliveryMetadata.product_type) ||
                null,
              deliveryHandlerCode,
              deliveryStatus: inlinePayload ? "delivered" : "pending",
              deliveryPayload: inlinePayload,
              deliveredBy: "system",
              metadata: {
                source: "payment_finalize",
                ...deliveryMetadata,
              },
            })

            await emitDeliveryCreated(container, {
              delivery: deliveryResult.delivery,
              accessToken: deliveryResult.accessToken,
              created: deliveryResult.created,
              updated: deliveryResult.updated,
              orderId: order.id,
              metadata: {
                source: "payment_finalize",
                ...deliveryMetadata,
              },
            })
          }

          const orderAccess = getOrderAccessProvider("guest-order-access")

          if (!orderAccess) {
            throw new Error(
              "Order access provider guest-order-access is not registered"
            )
          }

          await orderAccess.revokeActiveTokens({
            scope: container,
            orderId: order.id,
            purpose: "view_order",
          })

          updatedAttempt = await paymentRouter.updatePaymentAttempts({
            id: updatedAttempt.id,
            response_payload: markPaymentAttemptFinalized(
              updatedAttempt.response_payload
            ),
          })

          try {
            await emitPaymentAttemptFinalizedEvent(container, {
              attempt: updatedAttempt,
              orderId: order.id,
            })
          } catch {
            // Hook consumers must not break the payment flow.
          }

          return {
            attempt: updatedAttempt,
            order_id: order.id,
          }
        } catch (error) {
          try {
            await paymentRouter.updatePaymentAttempts({
              id: updatedAttempt.id,
              response_payload: markPaymentAttemptFinalizationFailed(
                updatedAttempt.response_payload,
                error instanceof Error
                  ? error.message
                  : "Payment finalization failed"
              ),
            })
          } catch {
            // Preserve the original finalization failure for the caller/retry path.
          }
          throw error
        }
      },
      {
        timeout: 30,
      }
    )

    return new StepResponse(result)
  }
)

function normalizeRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

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

function resolveInlineDeliveryPayload(metadata: Record<string, unknown>) {
  if ("delivery_payload" in metadata) {
    return normalizeDeliveryPayload(metadata.delivery_payload)
  }

  if ("deliveryPayload" in metadata) {
    return normalizeDeliveryPayload(metadata.deliveryPayload)
  }

  const downloadUrl =
    toOptionalString(metadata.download_url) ||
    toOptionalString(metadata.downloadUrl) ||
    toOptionalString(metadata.access_url) ||
    toOptionalString(metadata.accessUrl)

  if (downloadUrl) {
    return {
      download_url: downloadUrl,
    }
  }

  return undefined
}

function normalizeDeliveryPayload(value: unknown) {
  if (typeof value === "string") {
    return value.trim() ? value : undefined
  }

  if (value && typeof value === "object") {
    return value as Record<string, unknown>
  }

  return undefined
}

async function emitDeliveryCreated(
  container: MedusaContainer,
  input: {
    delivery: Record<string, unknown>
    accessToken: string | null
    created?: boolean
    updated?: boolean
    orderId: string
    metadata: Record<string, unknown>
  }
) {
  const { created: _created, updated: _updated, ...eventInput } = input

  if (input.created === false && input.updated) {
    try {
      await emitDeliveryCompletedEvent(container, eventInput)
    } catch {
      // Hook consumers must not break payment finalization.
    }
    return
  }

  if (input.created === false) {
    return
  }

  try {
    await emitDeliveryCreatedEvent(container, eventInput)
  } catch {
    // Hook consumers must not break payment finalization.
  }
}
