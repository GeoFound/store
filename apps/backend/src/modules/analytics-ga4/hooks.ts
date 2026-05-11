import type {
  OrderAccessRecoveryCodeCreatedEvent,
  OrderAccessTokenIssuedEvent,
  PaymentAttemptFinalizedEvent,
} from "../../platform/events"
import { PLATFORM_HOOKS } from "../../platform/hooks"
import { registerPlatformHook } from "../../platform/runtime"
import {
  ANALYTICS_CORE_MODULE,
} from "../analytics-core"
import type AnalyticsCoreModuleService from "../analytics-core/service"
import { ensureAnalyticsGa4DestinationRegistered } from "./destination"
import { isGa4BackendEnabled } from "./config"
import {
  buildGa4OrderAccessPayload,
  buildGa4PurchasePayload,
} from "./payload"

let hooksRegistered = false

export function ensureAnalyticsGa4HooksRegistered() {
  ensureAnalyticsGa4DestinationRegistered()

  if (hooksRegistered) {
    return
  }

  registerPlatformHook<PaymentAttemptFinalizedEvent>({
    hook: PLATFORM_HOOKS.paymentAttemptFinalized,
    pluginId: "analytics-ga4",
    name: "analytics-ga4.payment-attempt-finalized",
    version: "v1",
    enabled: true,
    handler: async (event) => {
      if (!isGa4BackendEnabled()) {
        return
      }

      const analytics: AnalyticsCoreModuleService = event.scope.resolve(
        ANALYTICS_CORE_MODULE
      )

      const attempt = normalizeRecord(event.payload.attempt)
      const requestPayload = normalizeRecord(attempt.request_payload)

      await analytics.captureEvent({
        scope: event.scope,
        eventName: "purchase",
        source: "backend_hook",
        eventKey: `ga4:purchase:${String(attempt.id)}:${event.payload.orderId}`,
        occurredAt: event.occurredAt,
        destinationCodes: ["ga4"],
        cartId: toOptionalText(attempt.cart_id) || null,
        orderId: event.payload.orderId,
        paymentAttemptId: toOptionalText(attempt.id) || null,
        customerEmail: toOptionalText(requestPayload.customer_email) || null,
        payload: buildGa4PurchasePayload({
          orderId: event.payload.orderId,
          attempt,
        }),
        metadata: {
          source_hook: "payment_attempt.finalized",
        },
      })
    },
  })

  registerPlatformHook<OrderAccessTokenIssuedEvent>({
    hook: PLATFORM_HOOKS.orderAccessTokenIssued,
    pluginId: "analytics-ga4",
    name: "analytics-ga4.order-access-token-issued",
    version: "v1",
    enabled: true,
    handler: async (event) => {
      if (!isGa4BackendEnabled()) {
        return
      }

      const eventName =
        event.payload.source === "store_order_recovery_verify"
          ? "order_recovery_verified"
          : "order_access_claimed"

      const analytics: AnalyticsCoreModuleService = event.scope.resolve(
        ANALYTICS_CORE_MODULE
      )

      await analytics.captureEvent({
        scope: event.scope,
        eventName,
        source: "backend_hook",
        eventKey: `ga4:${eventName}:${event.payload.orderId}:${event.payload.source}`,
        occurredAt: event.occurredAt,
        destinationCodes: ["ga4"],
        orderId: event.payload.orderId,
        customerEmail: event.payload.customerEmail,
        payload: buildGa4OrderAccessPayload({
          eventName,
          orderId: event.payload.orderId,
          payload: event.payload as unknown as Record<string, unknown>,
        }),
        metadata: {
          source_hook: "order_access.token_issued",
        },
      })
    },
  })

  registerPlatformHook<OrderAccessRecoveryCodeCreatedEvent>({
    hook: PLATFORM_HOOKS.orderAccessRecoveryCodeCreated,
    pluginId: "analytics-ga4",
    name: "analytics-ga4.order-access-recovery-code-created",
    version: "v1",
    enabled: true,
    handler: async (event) => {
      if (!isGa4BackendEnabled()) {
        return
      }

      const analytics: AnalyticsCoreModuleService = event.scope.resolve(
        ANALYTICS_CORE_MODULE
      )

      await analytics.captureEvent({
        scope: event.scope,
        eventName: "order_recovery_code_sent",
        source: "backend_hook",
        eventKey: `ga4:order_recovery_code_sent:${event.payload.orderId}:${event.payload.customerEmail}`,
        occurredAt: event.occurredAt,
        destinationCodes: ["ga4"],
        orderId: event.payload.orderId,
        customerEmail: event.payload.customerEmail,
        payload: buildGa4OrderAccessPayload({
          eventName: "order_recovery_code_sent",
          orderId: event.payload.orderId,
          payload: {
            source: "store_order_recovery",
            purpose: "view_order",
          },
        }),
        metadata: {
          source_hook: "order_access.recovery_code_created",
        },
      })
    },
  })

  hooksRegistered = true
}

export function resetAnalyticsGa4HooksForTests() {
  hooksRegistered = false
}

function normalizeRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

function toOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}
