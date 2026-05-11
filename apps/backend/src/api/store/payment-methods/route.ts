import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import PaymentRouterModuleService from "../../../modules/payment-router/service"
import { PAYMENT_ROUTER_MODULE } from "../../../modules/payment-router"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const paymentRouter: PaymentRouterModuleService =
    req.scope.resolve(PAYMENT_ROUTER_MODULE)
  const query = (req.validatedQuery || req.query) as {
    amount?: number
    currency?: string
  }

  const amount =
    typeof query.amount === "number" && Number.isFinite(query.amount)
      ? query.amount
      : undefined
  const currency =
    typeof query.currency === "string"
      ? query.currency.trim().toLowerCase()
      : undefined

  const channels = await paymentRouter.listAvailablePaymentChannels({
    amount,
    currency,
  })

  res.json({
    methods: channels.map((channel) => ({
      id: channel.id,
      code: channel.code,
      display_name: channel.display_name,
      type: channel.type,
      priority: channel.priority,
      health_status: channel.health_status,
    })),
  })
}
