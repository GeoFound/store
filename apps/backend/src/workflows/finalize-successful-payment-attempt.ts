import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { finalizePaymentAttemptStep } from "./steps/payment/finalize-payment-attempt"

const finalizeSuccessfulPaymentAttemptWorkflow = createWorkflow(
  "finalize-successful-payment-attempt",
  function (
    input:
      | {
          attemptId: string
          callbackPayload?: Record<string, unknown> | null
        }
      | {
          providerOrderId: string
          providerCode?: string
          callbackPayload?: Record<string, unknown> | null
        }
  ) {
    const result = finalizePaymentAttemptStep(input)

    return new WorkflowResponse(result)
  }
)

export default finalizeSuccessfulPaymentAttemptWorkflow
