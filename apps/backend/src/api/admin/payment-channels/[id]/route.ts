import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolvePaymentRouterService } from "../../../../platform-adapters/services"
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
  const body = (req.validatedBody || req.body) as UpdateChannelBody
  const paymentRouter = resolvePaymentRouterService(req.scope)
  const existing = await paymentRouter.retrievePaymentChannel(req.params.id)
  paymentRouter.assertProviderRegistered(existing.provider_code)
  const currency = normalizeCurrencyCode(body.currency)

  if (typeof body.currency !== "undefined" && body.currency !== null && !currency) {
    localizedError(req, res, 400, "paymentChannel.currencyInvalid")
    return
  }

  const channel = await paymentRouter.updatePaymentChannels({
    id: req.params.id,
    ...(typeof body.display_name === "string"
      ? { display_name: body.display_name }
      : {}),
    ...(typeof body.enabled === "boolean"
      ? { enabled: body.enabled }
      : {}),
    ...(typeof body.priority === "number"
      ? { priority: body.priority }
      : {}),
    ...(typeof body.min_amount !== "undefined"
      ? { min_amount: body.min_amount }
      : {}),
    ...(typeof body.max_amount !== "undefined"
      ? { max_amount: body.max_amount }
      : {}),
    ...(typeof body.currency !== "undefined"
      ? { currency: currency || null }
      : {}),
    ...(body.health_status ? { health_status: body.health_status } : {}),
    ...(typeof body.config_json !== "undefined"
      ? { config_json: body.config_json }
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
