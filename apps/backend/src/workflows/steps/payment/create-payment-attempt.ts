import type { MedusaContainer } from "@medusajs/framework/types"
import {
  createStep,
  StepResponse,
} from "@medusajs/framework/workflows-sdk"
import PaymentRouterModuleService from "../../../modules/payment-router/service"
import { PAYMENT_ROUTER_MODULE } from "../../../modules/payment-router"
import type { CreatePaymentAttemptInput } from "../../../modules/payment-router/types"

export const createPaymentAttemptStep = createStep(
  "create-payment-attempt",
  async (input: CreatePaymentAttemptInput, { container }: { container: MedusaContainer }) => {
    const paymentRouter: PaymentRouterModuleService = container.resolve(
      PAYMENT_ROUTER_MODULE
    )

    const result = await paymentRouter.createPaymentAttemptForCart(input)

    return new StepResponse(result)
  }
)
