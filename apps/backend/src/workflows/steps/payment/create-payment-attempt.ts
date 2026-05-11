import type { MedusaContainer } from "@medusajs/framework/types"
import type { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  createStep,
  StepResponse,
} from "@medusajs/framework/workflows-sdk"
import PaymentRouterModuleService from "../../../modules/payment-router/service"
import { PAYMENT_ROUTER_MODULE } from "../../../modules/payment-router"
import type { CreatePaymentAttemptInput } from "../../../modules/payment-router/types"
import { handleMarketingAttemptClosed } from "../../../modules/marketing-engine/hooks"
import { extractInventoryReservations } from "../../../utils/payment-attempt"
import { releaseInventoryReservations } from "./inventory-reservation-cleanup"

export const createPaymentAttemptStep = createStep(
  "create-payment-attempt",
  async (input: CreatePaymentAttemptInput, { container }: { container: MedusaContainer }) => {
    const paymentRouter: PaymentRouterModuleService = container.resolve(
      PAYMENT_ROUTER_MODULE
    )
    const locking: ILockingModule = container.resolve(Modules.LOCKING)

    const result = await locking.execute(
      `cart:${input.cartId}`,
      async () => {
        const pendingAttempts = await paymentRouter.listPaymentAttempts(
          {
            cart_id: input.cartId,
            status: "pending",
          },
          {
            order: {
              created_at: "DESC",
            },
          }
        )

        for (const attempt of pendingAttempts) {
          await releaseInventoryReservations(
            container,
            extractInventoryReservations(attempt.response_payload).map(
              (reservation) => ({
                handler_code: reservation.handler_code || "credential-inventory",
                reservation_key: reservation.reservation_key,
                item_ids: reservation.item_ids,
                metadata: reservation.metadata,
              })
            )
          )

          const closedAttempt = await paymentRouter.markAttemptExpired({
            id: attempt.id,
            callbackPayload: {
              source: "cart_payment_retry",
              cart_id: input.cartId,
            },
          })

          try {
            await handleMarketingAttemptClosed(container, {
              attemptId: closedAttempt.id,
              customerEmail:
                typeof closedAttempt.request_payload === "object" &&
                closedAttempt.request_payload &&
                typeof (closedAttempt.request_payload as Record<string, unknown>)
                  .customer_email === "string"
                  ? String(
                      (closedAttempt.request_payload as Record<string, unknown>)
                        .customer_email
                    )
                  : null,
              reason: "cart_retry_replaced",
              payload:
                (closedAttempt.response_payload as Record<string, unknown> | null) ||
                null,
            })
          } catch {
            // Marketing close handlers are best-effort and must not block retries.
          }
        }

        return paymentRouter.createPaymentAttemptForCart(input)
      },
      {
        timeout: 30,
      }
    )

    return new StepResponse(result)
  }
)
