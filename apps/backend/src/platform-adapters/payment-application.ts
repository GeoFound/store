import {
  createStorefrontPaymentApplication,
  type StorefrontPaymentRepository,
} from "../application/payment"
import type { BackendRuntimeContext } from "../platform/backend-context"
import { resolvePaymentRouterService } from "./services"

export function resolveStorefrontPaymentApplication(scope: BackendRuntimeContext) {
  const paymentRouter = resolvePaymentRouterService(scope)
  const repository: StorefrontPaymentRepository = {
    listAvailablePaymentChannels(input) {
      return paymentRouter.listAvailablePaymentChannels(input)
    },
  }

  return createStorefrontPaymentApplication(repository)
}
