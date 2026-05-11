import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import PaymentRouterModuleService from "../../../../modules/payment-router/service"
import { PAYMENT_ROUTER_MODULE } from "../../../../modules/payment-router"

type UpdateChannelBody = {
  display_name?: string
  enabled?: boolean
  priority?: number
  min_amount?: number | null
  max_amount?: number | null
  currency?: string | null
  health_status?: "healthy" | "degraded" | "down"
  config_json?: Record<string, unknown> | null
}

export const POST = async (
  req: MedusaRequest<UpdateChannelBody>,
  res: MedusaResponse
) => {
  const paymentRouter: PaymentRouterModuleService =
    req.scope.resolve(PAYMENT_ROUTER_MODULE)
  const existing = await paymentRouter.retrievePaymentChannel(req.params.id)
  paymentRouter.assertProviderRegistered(existing.provider_code)

  const channel = await paymentRouter.updatePaymentChannels({
    id: req.params.id,
    ...(typeof req.body.display_name === "string"
      ? { display_name: req.body.display_name }
      : {}),
    ...(typeof req.body.enabled === "boolean"
      ? { enabled: req.body.enabled }
      : {}),
    ...(typeof req.body.priority === "number"
      ? { priority: req.body.priority }
      : {}),
    ...(typeof req.body.min_amount !== "undefined"
      ? { min_amount: req.body.min_amount }
      : {}),
    ...(typeof req.body.max_amount !== "undefined"
      ? { max_amount: req.body.max_amount }
      : {}),
    ...(typeof req.body.currency !== "undefined"
      ? { currency: req.body.currency || null }
      : {}),
    ...(req.body.health_status ? { health_status: req.body.health_status } : {}),
    ...(typeof req.body.config_json !== "undefined"
      ? { config_json: req.body.config_json }
      : {}),
  })

  res.json({
    channel,
  })
}
