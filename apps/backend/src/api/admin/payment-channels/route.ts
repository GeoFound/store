import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolvePaymentRouterService } from "../../../platform-adapters/services"
import { localizedError } from "../../../utils/localized-response"

type CreateChannelBody = {
  code?: string
  name?: string
  display_name?: string
  type?: "manual" | "aggregate_cn" | "crypto"
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
  const body = (req.validatedBody || req.body) as CreateChannelBody

  if (
    !body.code ||
    !body.name ||
    !body.display_name ||
    !body.type ||
    !body.provider_code
  ) {
    localizedError(req, res, 400, "paymentChannel.required")
    return
  }

  const paymentRouter = resolvePaymentRouterService(req.scope)
  paymentRouter.assertProviderRegistered(body.provider_code)
  const currency = normalizeCurrencyCode(body.currency)
  const type = normalizeChannelType(body.type)
  const healthStatus = normalizeHealthStatus(body.health_status)

  if (!type || !healthStatus) {
    localizedError(req, res, 400, "paymentChannel.required")
    return
  }

  if (typeof body.currency !== "undefined" && body.currency !== null && !currency) {
    localizedError(req, res, 400, "paymentChannel.currencyInvalid")
    return
  }

  const channel = await paymentRouter.createPaymentChannels({
    code: body.code,
    name: body.name,
    display_name: body.display_name,
    type,
    enabled: body.enabled ?? true,
    priority: body.priority ?? 100,
    min_amount: body.min_amount ?? null,
    max_amount: body.max_amount ?? null,
    currency: currency || null,
    provider_code: body.provider_code,
    config_json: body.config_json || null,
    health_status: healthStatus,
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

function normalizeChannelType(value: unknown) {
  return value === "manual" || value === "aggregate_cn" || value === "crypto"
    ? value
    : ""
}

function normalizeHealthStatus(value: unknown) {
  if (typeof value === "undefined" || value === null || value === "") {
    return "healthy"
  }

  return value === "healthy" || value === "degraded" || value === "down"
    ? value
    : ""
}
