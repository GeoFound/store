import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolvePaymentRouterService } from "../../../../platform/services"
import { localizedError } from "../../../../utils/localized-response"

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
  const paymentRouter = resolvePaymentRouterService(req.scope)
  const existing = await paymentRouter.retrievePaymentChannel(req.params.id)
  paymentRouter.assertProviderRegistered(existing.provider_code)
  const currency = normalizeCurrencyCode(req.body.currency)

  if (typeof req.body.currency !== "undefined" && req.body.currency !== null && !currency) {
    localizedError(req, res, 400, "paymentChannel.currencyInvalid")
    return
  }

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
      ? { currency: currency || null }
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

function normalizeCurrencyCode(value: unknown) {
  if (typeof value !== "string") {
    return ""
  }

  const normalized = value.trim().toLowerCase()

  return /^[a-z]{3}$/.test(normalized) ? normalized : ""
}
