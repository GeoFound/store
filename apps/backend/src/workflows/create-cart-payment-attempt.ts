import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import type { CreatePaymentAttemptInput } from "../modules/payment-router/types"
import type { FulfillmentCartItem } from "../platform/inventory"
import type { MarketingCheckoutContextInput } from "../platform/marketing"
import { applyMarketingContextStep } from "./steps/payment/apply-marketing-context"
import { createPaymentAttemptStep } from "./steps/payment/create-payment-attempt"
import { reserveCartInventoryStep } from "./steps/payment/reserve-cart-inventory"

export type CreateCartPaymentAttemptWorkflowInput = CreatePaymentAttemptInput & {
  items: FulfillmentCartItem[]
  marketing?: MarketingCheckoutContextInput
}

const createCartPaymentAttemptWorkflow = createWorkflow(
  "create-cart-payment-attempt",
  function (input: CreateCartPaymentAttemptWorkflowInput) {
    const attemptResult = createPaymentAttemptStep(input)
    const marketingResult = applyMarketingContextStep({
      attemptId: attemptResult.attempt.id,
      cartId: input.cartId,
      amount: input.amount,
      currency: input.currency,
      customerEmail: input.customerEmail || null,
      context: input.marketing || {},
      attemptRequestPayload: attemptResult.attempt.request_payload as
        | Record<string, unknown>
        | null
        | undefined,
      attemptResponsePayload: attemptResult.attempt.response_payload as
        | Record<string, unknown>
        | null
        | undefined,
    })
    const reservationResult = reserveCartInventoryStep({
      cartId: input.cartId,
      attemptId: marketingResult.attempt.id,
      items: input.items,
      attemptResponsePayload: marketingResult.attempt.response_payload as
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
      marketingContext: marketingResult.marketingContext,
    })
  }
)

export default createCartPaymentAttemptWorkflow
