import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type {
  DeliveryCompletedEvent,
  DeliveryCreatedEvent,
  OrderAccessRecoveryCodeCreatedEvent,
  OrderAccessTokenIssuedEvent,
  PaymentAttemptFinalizedEvent,
  PaymentAttemptReservedEvent,
} from "./events"
import { PLATFORM_HOOKS } from "./hooks"
import { registerPlatformHook } from "./runtime"

let observabilityHooksRegistered = false

export function ensurePlatformObservabilityHooksRegistered() {
  if (observabilityHooksRegistered) {
    return
  }

  registerPlatformHook<PaymentAttemptReservedEvent>({
    hook: PLATFORM_HOOKS.paymentAttemptReserved,
    pluginId: "platform.observability",
    name: "platform.observability.payment-attempt-reserved",
    version: "1.0.0",
    enabled: true,
    handler: async (event) => {
      const logger = event.scope.resolve(ContainerRegistrationKeys.LOGGER) as {
        info: (message: string, meta?: Record<string, unknown>) => void
      }

      logger.info("Platform event: payment attempt reserved", {
        event: event.name,
        occurred_at: event.occurredAt,
        attempt_id: event.payload.attempt.id,
        reservation_count: event.payload.inventoryReservations.length,
      })
    },
  })

  registerPlatformHook<PaymentAttemptFinalizedEvent>({
    hook: PLATFORM_HOOKS.paymentAttemptFinalized,
    pluginId: "platform.observability",
    name: "platform.observability.payment-attempt-finalized",
    version: "1.0.0",
    enabled: true,
    handler: async (event) => {
      const logger = event.scope.resolve(ContainerRegistrationKeys.LOGGER) as {
        info: (message: string, meta?: Record<string, unknown>) => void
      }

      logger.info("Platform event: payment attempt finalized", {
        event: event.name,
        occurred_at: event.occurredAt,
        attempt_id: event.payload.attempt.id,
        order_id: event.payload.orderId,
      })
    },
  })

  registerPlatformHook<DeliveryCreatedEvent>({
    hook: PLATFORM_HOOKS.deliveryCreated,
    pluginId: "platform.observability",
    name: "platform.observability.delivery-created",
    version: "1.0.0",
    enabled: true,
    handler: async (event) => {
      const logger = event.scope.resolve(ContainerRegistrationKeys.LOGGER) as {
        info: (message: string, meta?: Record<string, unknown>) => void
      }

      logger.info("Platform event: delivery created", {
        event: event.name,
        occurred_at: event.occurredAt,
        delivery_id: event.payload.delivery.id,
        order_id: event.payload.orderId || null,
        access_token_issued: Boolean(event.payload.accessToken),
      })
    },
  })

  registerPlatformHook<DeliveryCompletedEvent>({
    hook: PLATFORM_HOOKS.deliveryCompleted,
    pluginId: "platform.observability",
    name: "platform.observability.delivery-completed",
    version: "1.0.0",
    enabled: true,
    handler: async (event) => {
      const logger = event.scope.resolve(ContainerRegistrationKeys.LOGGER) as {
        info: (message: string, meta?: Record<string, unknown>) => void
      }

      logger.info("Platform event: delivery completed", {
        event: event.name,
        occurred_at: event.occurredAt,
        delivery_id: event.payload.delivery.id,
        order_id: event.payload.orderId || null,
        access_token_issued: Boolean(event.payload.accessToken),
      })
    },
  })

  registerPlatformHook<OrderAccessRecoveryCodeCreatedEvent>({
    hook: PLATFORM_HOOKS.orderAccessRecoveryCodeCreated,
    pluginId: "platform.observability",
    name: "platform.observability.order-access-recovery-code-created",
    version: "1.0.0",
    enabled: true,
    handler: async (event) => {
      const logger = event.scope.resolve(ContainerRegistrationKeys.LOGGER) as {
        info: (message: string, meta?: Record<string, unknown>) => void
      }

      logger.info("Platform event: order access recovery code created", {
        event: event.name,
        occurred_at: event.occurredAt,
        order_id: event.payload.orderId,
        customer_email: event.payload.customerEmail,
      })
    },
  })

  registerPlatformHook<OrderAccessTokenIssuedEvent>({
    hook: PLATFORM_HOOKS.orderAccessTokenIssued,
    pluginId: "platform.observability",
    name: "platform.observability.order-access-token-issued",
    version: "1.0.0",
    enabled: true,
    handler: async (event) => {
      const logger = event.scope.resolve(ContainerRegistrationKeys.LOGGER) as {
        info: (message: string, meta?: Record<string, unknown>) => void
      }

      logger.info("Platform event: order access token issued", {
        event: event.name,
        occurred_at: event.occurredAt,
        order_id: event.payload.orderId,
        purpose: event.payload.purpose,
        source: event.payload.source,
      })
    },
  })

  observabilityHooksRegistered = true
}

export function resetPlatformObservabilityForTests() {
  observabilityHooksRegistered = false
}
