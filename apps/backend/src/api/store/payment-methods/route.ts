import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolvePaymentRouterService } from "../../../platform-adapters/services"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const paymentRouter = resolvePaymentRouterService(req.scope)
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
