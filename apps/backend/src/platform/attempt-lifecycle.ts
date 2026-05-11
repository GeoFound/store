import type { MedusaContainer } from "@medusajs/framework/types"
import { handleMarketingAttemptClosed } from "../modules/marketing-engine/hooks"

export type PaymentAttemptClosedInput = {
  attemptId: string
  customerEmail?: string | null
  reason?: string
  payload?: Record<string, unknown> | null
}

export async function handlePaymentAttemptClosed(
  scope: MedusaContainer,
  input: PaymentAttemptClosedInput
) {
  await handleMarketingAttemptClosed(scope, input)
}
