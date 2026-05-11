import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import PaymentRouterModuleService from "../../../modules/payment-router/service"
import { PAYMENT_ROUTER_MODULE } from "../../../modules/payment-router"

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
  const paymentRouter: PaymentRouterModuleService =
    req.scope.resolve(PAYMENT_ROUTER_MODULE)

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
    res.status(400).json({
      message: "code, name, and display_name are required",
    })
    return
  }

  const paymentRouter: PaymentRouterModuleService =
    req.scope.resolve(PAYMENT_ROUTER_MODULE)
  paymentRouter.assertProviderRegistered(
    req.body.provider_code || req.body.code
  )
  const currency = normalizeCurrencyCode(req.body.currency)

  if (typeof req.body.currency !== "undefined" && req.body.currency !== null && !currency) {
    res.status(400).json({
      message: "currency must be a valid 3-letter code",
    })
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
