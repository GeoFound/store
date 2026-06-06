import type { BackendRuntimeContext } from "./backend-context"
import { emitPaymentAttemptClosedEvent } from "./events"

export type PaymentAttemptClosedInput = {
  attemptId: string
  customerEmail?: string | null
  reason?: string
  payload?: Record<string, unknown> | null
}

export async function handlePaymentAttemptClosed(
  scope: BackendRuntimeContext,
  input: PaymentAttemptClosedInput
) {
  await emitPaymentAttemptClosedEvent(scope, input)
}
