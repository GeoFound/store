import type { MedusaContainer } from "@medusajs/framework/types"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { ensureCartOrder } from "../../../utils/ensure-cart-order"
import {
  extractInventoryReservations,
  isPaymentAttemptFinalized,
  markPaymentAttemptFinalized,
} from "../../../utils/payment-attempt"
import {
  emitDeliveryCreatedEvent,
  emitPaymentAttemptFinalizedEvent,
} from "../../../platform/events"
import { getDeliveryHandler } from "../../../platform/delivery"
import { getInventoryHandler } from "../../../platform/inventory"
import { getOrderAccessProviderOrFallback } from "../../../platform/order-access"
import { ensurePlatformIntegrationsRegistered } from "../../../platform/integrations"
import { resolvePaymentRouterService } from "../../../platform/services"

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

        const order = await ensureCartOrder(container, {
          cartId: String(attempt.cart_id),
          orderId: attempt.order_id,
          transactionReferenceId: attempt.id,
        })

        let updatedAttempt = attempt
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
          const handlerCode =
            reservation.handler_code || "credential-inventory"
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
            const deliveryHandlerCode =
              toOptionalString(deliveryMetadata.delivery_handler_code) ||
              toOptionalString(deliveryMetadata.deliveryHandlerCode) ||
              "credential"
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
              accountItemId,
              productVariantId:
                toOptionalString(deliveryMetadata.product_variant_id) ||
                undefined,
              productType:
                toOptionalString(deliveryMetadata.product_type) || null,
              deliveryHandlerCode,
              deliveredBy: "system",
              metadata: {
                source: "payment_finalize",
                ...deliveryMetadata,
              },
            })

            try {
              await emitDeliveryCreatedEvent(container, {
                delivery: deliveryResult.delivery,
                accessToken: deliveryResult.accessToken,
                orderId: order.id,
                metadata: {
                  source: "payment_finalize",
                  ...deliveryMetadata,
                },
              })
            } catch {
              // Hook consumers must not break payment finalization.
            }
          }
        }

        const orderAccess = getOrderAccessProviderOrFallback(
          "guest-order-access"
        )
        await orderAccess?.revokeActiveTokens({
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
