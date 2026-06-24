import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import {
  isOrderAccessApplicationError,
  type OrderAccessApplicationErrorCode,
} from "../../../../application/order-access"
import { resolveStorefrontOrderAccessApplication } from "../../../../platform-adapters/order-access"
import {
  localizedError,
  resolveRequestLocale,
} from "../../../../utils/localized-response"
import { getRequestAuditContext } from "../../../../utils/request-audit"

type RecoverOrderBody = {
  email?: string
  order_id?: string
}

export const POST = async (
  req: MedusaRequest<RecoverOrderBody>,
  res: MedusaResponse
) => {
  const body = (req.validatedBody || req.body) as RecoverOrderBody
  const orderAccess = resolveStorefrontOrderAccessApplication(req.scope)
  const { ipAddress, userAgent } = getRequestAuditContext(req)

  let result

  try {
    result = await orderAccess.requestRecoveryCode({
      orderId: body.order_id,
      email: body.email,
      locale: resolveRequestLocale(req),
      audit: {
        ipAddress,
        userAgent,
      },
    })
  } catch (error) {
    if (handleOrderAccessApplicationError(req, res, error)) {
      return
    }

    if (isOrderAccessApplicationError(error, "recovery_notification_failed")) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        error.message
      )
    }

    throw error
  }

  res.status(202).json(result)
}

function handleOrderAccessApplicationError(
  req: MedusaRequest,
  res: MedusaResponse,
  error: unknown
) {
  if (!isOrderAccessApplicationError(error)) {
    return false
  }

  const localized = mapOrderAccessError(error.code)

  if (!localized) {
    return false
  }

  localizedError(req, res, localized.status, localized.key)
  return true
}

function mapOrderAccessError(code: OrderAccessApplicationErrorCode) {
  switch (code) {
    case "guest_unavailable":
    case "provider_unavailable":
      return { status: 503, key: "orderAccess.guestUnavailable" as const }
    case "order_not_found":
      return { status: 404, key: "orderAccess.orderNotFound" as const }
    case "recovery_cooldown":
      return { status: 429, key: "orderAccess.recoveryCooldown" as const }
    default:
      return null
  }
}
