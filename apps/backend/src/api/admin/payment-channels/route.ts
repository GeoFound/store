import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolvePaymentRouterService } from "../../../platform/services"
import { localizedError } from "../../../utils/localized-response"

type CreateChannelBody = {
  code?: string
  name?: string
  display_name?: string
  type?: string
  enabled?: boolean
  priority?: number
  min_amount?: number
  max_amount?: number
  currency?: string
  provider_code?: string
  health_status?: "healthy" | "degraded" | "down"
  config_json?: Record<string, unknown>
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const paymentRouter = resolvePaymentRouterService(req.scope)

  await paymentRouter.ensureDefaultChannels()

  const channels = await paymentRouter.listPaymentChannels(
    {},
    {
      take: 50,
      order: {
        priority: "ASC",
      },
    }
  )

  res.json({
    channels,
  })
}

export const POST = async (
  req: MedusaRequest<CreateChannelBody>,
  res: MedusaResponse
) => {
  if (!req.body.code || !req.body.name || !req.body.display_name) {
    localizedError(req, res, 400, "paymentChannel.required")
    return
  }

  const paymentRouter = resolvePaymentRouterService(req.scope)
  paymentRouter.assertProviderRegistered(
    req.body.provider_code || req.body.code
  )
  const currency = normalizeCurrencyCode(req.body.currency)

  if (typeof req.body.currency !== "undefined" && req.body.currency !== null && !currency) {
    localizedError(req, res, 400, "paymentChannel.currencyInvalid")
    return
  }

  const channel = await paymentRouter.createPaymentChannels({
    code: req.body.code,
    name: req.body.name,
    display_name: req.body.display_name,
    type: req.body.type || "manual",
    enabled: req.body.enabled ?? true,
    priority: req.body.priority ?? 100,
    min_amount: req.body.min_amount ?? null,
    max_amount: req.body.max_amount ?? null,
    currency: currency || null,
    provider_code: req.body.provider_code || req.body.code,
    config_json: req.body.config_json || null,
    health_status: req.body.health_status || "healthy",
  })

  res.status(201).json({
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
