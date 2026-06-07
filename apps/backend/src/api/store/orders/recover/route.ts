import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { ILockingModule } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { emitOrderAccessRecoveryCodeCreatedEvent } from "../../../../platform/events"
import { isPlatformPluginEnabled } from "../../../../platform/runtime"
import { resolveConfiguredOrderAccessProviderCode } from "../../../../platform-adapters/order-access"
import { resolveGuestOrderAccessService } from "../../../../platform-adapters/services"
import { emitAuditLog } from "../../../../utils/audit-log"
import {
  localizedError,
  resolveRequestLocale,
} from "../../../../utils/localized-response"
import { getRequestAuditContext } from "../../../../utils/request-audit"
import { normalizeEmail, retrieveStoreOrderDetail } from "../../../../utils/store-order"

type RecoverOrderBody = {
  email?: string
  order_id?: string
}

export const POST = async (
  req: MedusaRequest<RecoverOrderBody>,
  res: MedusaResponse
) => {
  const body = (req.validatedBody || req.body) as RecoverOrderBody
  const orderAccessProviderCode = resolveConfiguredOrderAccessProviderCode()

  if (!isPlatformPluginEnabled(orderAccessProviderCode)) {
    localizedError(req, res, 503, "orderAccess.guestUnavailable")
    return
  }

  const guestOrderAccess = resolveGuestOrderAccessService(req.scope)
  const locking: ILockingModule = req.scope.resolve(Modules.LOCKING)
  const { ipAddress, userAgent } = getRequestAuditContext(req)
  const order = await retrieveStoreOrderDetail(req.scope, body.order_id || "", [
    "id",
    "email",
  ])

  if (normalizeEmail(order.email) !== normalizeEmail(body.email || "")) {
    localizedError(req, res, 404, "orderAccess.orderNotFound")
    return
  }

  const lockKey = `order-recovery-request:${String(order.id)}:${normalizeEmail(order.email)}`
  let recovery

  try {
    recovery = await locking.execute(
      lockKey,
      async () =>
        guestOrderAccess.createRecoveryCode({
          orderId: String(order.id),
          customerEmail: String(order.email),
          metadata: {
            source: "store_order_recovery",
          },
        }),
      {
        timeout: 30,
      }
    )
  } catch (error) {
    if (
      error instanceof MedusaError &&
      error.type === MedusaError.Types.NOT_ALLOWED
    ) {
      localizedError(req, res, 429, "orderAccess.recoveryCooldown")
      return
    }

    throw error
  }

  try {
    await emitOrderAccessRecoveryCodeCreatedEvent(req.scope, {
      orderId: String(order.id),
      customerEmail: String(order.email),
      code: recovery.token,
      expiresAt:
        recovery.record.expires_at instanceof Date
          ? recovery.record.expires_at.toISOString()
          : String(recovery.record.expires_at || ""),
      locale: resolveRequestLocale(req),
    })
  } catch (error) {
    await guestOrderAccess.revokeOrderAccessToken(String(recovery.record.id))

    try {
      await emitAuditLog(req.scope, {
        actorType: "system",
        action: "order.recovery_notification_failed",
        entityType: "order",
        entityId: String(order.id),
        riskLevel: "high",
        ipAddress,
        userAgent,
        metadata: {
          customer_email: normalizeEmail(order.email),
          recovery_token_id: String(recovery.record.id),
          error: error instanceof Error ? error.message : String(error),
        },
      })
    } catch {
      // Preserve the recovery notification failure for the caller.
    }

    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Recovery code could not be sent. Please try again."
    )
  }

  await emitAuditLog(req.scope, {
    actorType: "guest",
    action: "order.recovery_requested",
    entityType: "order",
    entityId: String(order.id),
    riskLevel: "medium",
    ipAddress,
    userAgent,
    metadata: {
      customer_email: normalizeEmail(order.email),
    },
  })

  res.status(202).json({
    order_id: order.id,
    expires_at: recovery.record.expires_at || null,
  })
}
