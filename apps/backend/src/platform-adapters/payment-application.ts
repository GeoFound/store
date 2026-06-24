import {
  createStorefrontPaymentApplication,
  type StorefrontPaymentRepository,
} from "../application/payment"
import type { BackendRuntimeContext } from "../platform/backend-context"
import createCartPaymentAttemptWorkflow from "../workflows/create-cart-payment-attempt"
import { loadPaymentCartContext } from "./cart-payment"
import { resolvePaymentRouterService } from "./services"

export function resolveStorefrontPaymentApplication(scope: BackendRuntimeContext) {
  const paymentRouter = resolvePaymentRouterService(scope)
  const repository: StorefrontPaymentRepository = {
    listAvailablePaymentChannels(input) {
      return paymentRouter.listAvailablePaymentChannels(input)
    },
    loadCartPaymentContext(cartId) {
      return loadPaymentCartContext(scope, cartId)
    },
    async createCartPaymentAttempt(input) {
      const workflowResult = await createCartPaymentAttemptWorkflow(
        scope as Parameters<typeof createCartPaymentAttemptWorkflow>[0]
      ).run({ input })

      return workflowResult.result
    },
  }

  return createStorefrontPaymentApplication(repository)
}
