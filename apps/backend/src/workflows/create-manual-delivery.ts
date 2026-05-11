import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { createDeliveryStep } from "./steps/delivery/create-delivery"

export type CreateManualDeliveryWorkflowInput = {
  orderId?: string
  cartId?: string
  paymentAttemptId?: string
  orderItemId?: string
  accountItemId?: string | null
  productVariantId?: string
  productType?: string | null
  fulfillmentPolicyCode?: string | null
  deliveryHandlerCode?: string | null
  deliveryPayload?: Record<string, unknown> | string
  deliveredBy?: string
  deliveryNote?: string
  metadata?: Record<string, unknown>
}

const createManualDeliveryWorkflow = createWorkflow(
  "create-manual-delivery",
  function (input: CreateManualDeliveryWorkflowInput) {
    const result = createDeliveryStep(input)

    return new WorkflowResponse(result)
  }
)

export default createManualDeliveryWorkflow
