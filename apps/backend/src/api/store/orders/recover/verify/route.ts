import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  isOrderAccessApplicationError,
  type OrderAccessApplicationErrorCode,
} from "../../../../../application/order-access"
import { resolveStorefrontOrderAccessApplication } from "../../../../../platform-adapters/order-access"
import { localizedError } from "../../../../../utils/localized-response"
import { getRequestAuditContext } from "../../../../../utils/request-audit"

type VerifyRecoveryBody = {
  order_id?: string
  code?: string
}

export const POST = async (
  req: MedusaRequest<VerifyRecoveryBody>,
  res: MedusaResponse
) => {
  const body = (req.validatedBody || req.body) as VerifyRecoveryBody

  const orderAccess = resolveStorefrontOrderAccessApplication(req.scope)
  const { ipAddress, userAgent } = getRequestAuditContext(req)

  try {
    const result = await orderAccess.verifyRecoveryCode({
      orderId: body.order_id,
      code: body.code,
      audit: {
        ipAddress,
        userAgent,
      },
    })

    res.json(result)
  } catch (error) {
    if (handleOrderAccessApplicationError(req, res, error)) {
      return
    }

    throw error
  }
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
      return {
        status: 503,
        key: "orderAccess.providerUnavailable" as const,
      }
    case "order_not_found":
      return {
        status: 404,
        key: "orderAccess.orderNotFound" as const,
      }
    default:
      return null
  }
}
