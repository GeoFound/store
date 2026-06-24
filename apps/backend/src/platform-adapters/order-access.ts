import type { ILockingModule, MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import {
  createStorefrontOrderAccessApplication,
  OrderAccessApplicationError,
  type StorefrontOrderAccessRepository,
} from "../application/order-access"
import {
  emitOrderAccessRecoveryCodeCreatedEvent,
  emitOrderAccessTokenIssuedEvent,
} from "../platform/events"
import { getOrderAccessProvider } from "../platform/order-access"
import { isPlatformPluginEnabled } from "../platform/runtime"
import { emitAuditLog } from "../utils/audit-log"
import { normalizeAttemptPayload } from "../utils/payment-attempt"
import { retrieveStoreOrderDetail } from "../utils/store-order"
import { createOrderAccessProviderScope } from "./backend-context"
import { resolveGuestOrderAccessService } from "./services"

const DEFAULT_ORDER_ACCESS_PROVIDER_CODE = "guest-order-access"

export function resolveConfiguredOrderAccessProviderCode(
  env: Record<string, string | undefined> = process.env
) {
  return (
    normalizeString(env.ORDER_ACCESS_PROVIDER_CODE) ||
    DEFAULT_ORDER_ACCESS_PROVIDER_CODE
  )
}

export function requireAttemptOrderAccessProviderCode(
  payload: unknown
) {
  const normalized = normalizeAttemptPayload(payload)
  const code = normalizeString(normalized.order_access_provider_code)

  if (!code) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Payment attempt is missing order_access_provider_code and cannot issue order access safely"
    )
  }

  return code
}

export function resolveOrderAccessProviderOrThrow(code: string) {
  const provider = getOrderAccessProvider(code)

  if (!provider) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Order access provider ${code} is not registered`
    )
  }

  return provider
}

export function resolveStorefrontOrderAccessApplication(
  scope: MedusaContainer
) {
  const repository = createStorefrontOrderAccessRepository(scope)

  return createStorefrontOrderAccessApplication(repository)
}

export function createStorefrontOrderAccessRepository(
  scope: MedusaContainer
): StorefrontOrderAccessRepository {
  return {
    isGuestOrderAccessAvailable() {
      return isPlatformPluginEnabled(resolveConfiguredOrderAccessProviderCode())
    },

    async retrieveOrderIdentity(orderId) {
      try {
        const order = await retrieveStoreOrderDetail(scope, orderId, [
          "id",
          "email",
        ])

        return {
          id: String(order.id),
          email: String(order.email),
        }
      } catch (error) {
        if (isMedusaError(error, MedusaError.Types.NOT_FOUND)) {
          return null
        }

        throw error
      }
    },

    async createRecoveryCode(input) {
      const guestOrderAccess = resolveGuestOrderAccessService(scope)
      const locking = scope.resolve<ILockingModule>(Modules.LOCKING)

      try {
        const recovery = await locking.execute(
          input.lockKey,
          async () =>
            guestOrderAccess.createRecoveryCode({
              orderId: input.orderId,
              customerEmail: input.customerEmail,
              metadata: input.metadata,
            }),
          {
            timeout: 30,
          }
        )

        return {
          token: recovery.token,
          record: {
            ...recovery.record,
            id: String(recovery.record.id),
          },
        }
      } catch (error) {
        if (isMedusaError(error, MedusaError.Types.NOT_ALLOWED)) {
          throw new OrderAccessApplicationError(
            "recovery_cooldown",
            "Recovery code was recently issued. Please wait before requesting another code.",
            { cause: error }
          )
        }

        throw error
      }
    },

    async revokeRecoveryCode(recordId) {
      const guestOrderAccess = resolveGuestOrderAccessService(scope)

      await guestOrderAccess.revokeOrderAccessToken(recordId)
    },

    async emitRecoveryCodeCreated(input) {
      await emitOrderAccessRecoveryCodeCreatedEvent(scope, input)
    },

    async verifyRecoveryCodeAndIssueViewToken(input) {
      const guestOrderAccess = resolveGuestOrderAccessService(scope)
      const locking = scope.resolve<ILockingModule>(Modules.LOCKING)
      const orderAccess = resolveConfiguredOrderAccessProvider()
      const orderAccessScope = createOrderAccessProviderScope(scope)

      return locking.execute(
        input.lockKey,
        async () => {
          await guestOrderAccess.verifyRecoveryCode({
            orderId: input.orderId,
            customerEmail: input.customerEmail,
            code: input.code,
          })

          const issued = await orderAccess.issueToken({
            scope: orderAccessScope,
            orderId: input.orderId,
            customerEmail: input.customerEmail,
            purpose: "view_order",
            metadata: input.metadata,
          })

          return {
            token: issued.token,
          }
        },
        {
          timeout: 30,
        }
      )
    },

    async emitOrderAccessTokenIssued(input) {
      await emitOrderAccessTokenIssuedEvent(scope, input)
    },

    async writeAuditLog(input) {
      await emitAuditLog(scope, input)
    },
  }
}

function resolveConfiguredOrderAccessProvider() {
  const providerCode = resolveConfiguredOrderAccessProviderCode()

  try {
    return resolveOrderAccessProviderOrThrow(providerCode)
  } catch (error) {
    if (isMedusaError(error, MedusaError.Types.NOT_ALLOWED)) {
      throw new OrderAccessApplicationError(
        "provider_unavailable",
        "Order access provider is not available",
        { cause: error }
      )
    }

    throw error
  }
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function isMedusaError(
  error: unknown,
  type: (typeof MedusaError.Types)[keyof typeof MedusaError.Types]
) {
  return error instanceof MedusaError && error.type === type
}
