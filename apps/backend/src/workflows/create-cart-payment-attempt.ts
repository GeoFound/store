import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import type { CreatePaymentAttemptInput } from "../modules/payment-router/types"
import type { FulfillmentCartItem } from "../platform/inventory"
import { createPaymentAttemptStep } from "./steps/payment/create-payment-attempt"
import { reserveCartInventoryStep } from "./steps/payment/reserve-cart-inventory"

export type CreateCartPaymentAttemptWorkflowInput = CreatePaymentAttemptInput & {
  items: FulfillmentCartItem[]
}

const createCartPaymentAttemptWorkflow = createWorkflow(
  "create-cart-payment-attempt",
  function (input: CreateCartPaymentAttemptWorkflowInput) {
    const attemptResult = createPaymentAttemptStep(input)
    const reservationResult = reserveCartInventoryStep({
      cartId: input.cartId,
      attemptId: attemptResult.attempt.id,
      items: input.items,
      attemptResponsePayload: attemptResult.attempt.response_payload as
        | Record<string, unknown>
        | null
        | undefined,
    })

    return new WorkflowResponse({
      attempt: reservationResult.attempt,
      instructions: attemptResult.instructions,
      inventoryReservations: reservationResult.inventoryReservations,
      claimToken: reservationResult.claimToken,
      responsePayload: reservationResult.responsePayload,
    })
  }
)

export default createCartPaymentAttemptWorkflow
