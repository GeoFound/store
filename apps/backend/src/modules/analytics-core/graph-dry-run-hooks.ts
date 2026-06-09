import type {
  OrderAccessTokenIssuedEvent,
  PaymentAttemptFinalizedEvent,
} from "../../platform/events"
import { PLATFORM_HOOKS } from "../../platform/hooks"
import { registerPlatformHook } from "../../platform/runtime"
import {
  ANALYTICS_CORE_MODULE,
  type AnalyticsCaptureService,
} from "../../platform/analytics"
import {
  GRAPH_DRY_RUN_DESTINATION_CODE,
  ensureGraphDryRunDestinationRegistered,
} from "./graph-dry-run-destination"
import { isGraphDryRunEnabled } from "./graph-dry-run-config"
import {
  buildGraphDryRunOrderAccessPayload,
  buildGraphDryRunPurchasePayload,
} from "./graph-dry-run-payload"

let hooksRegistered = false

export function ensureGraphDryRunHooksRegistered() {
  ensureGraphDryRunDestinationRegistered()

  if (hooksRegistered) {
    return
  }

  registerPlatformHook<PaymentAttemptFinalizedEvent>({
    hook: PLATFORM_HOOKS.paymentAttemptFinalized,
    pluginId: "analytics-core",
    name: "analytics-core.graph-dry-run.payment-attempt-finalized",
    version: "v1",
    enabled: true,
    handler: async (event) => {
      if (!isGraphDryRunEnabled()) {
        return
      }

      const analytics = event.scope.resolve<AnalyticsCaptureService>(
        ANALYTICS_CORE_MODULE
      )
      const attempt = normalizeRecord(event.payload.attempt)
      const requestPayload = normalizeRecord(attempt.request_payload)

      await analytics.captureEvent({
        scope: event.scope,
        eventName: "purchase",
        source: "backend_hook",
        eventKey: `graph:purchase:${String(attempt.id)}:${event.payload.orderId}`,
        occurredAt: event.occurredAt,
        destinationCodes: [GRAPH_DRY_RUN_DESTINATION_CODE],
        cartId: toOptionalText(attempt.cart_id) || null,
        orderId: event.payload.orderId,
        paymentAttemptId: toOptionalText(attempt.id) || null,
        customerEmail: toOptionalText(requestPayload.customer_email) || null,
        payload: buildGraphDryRunPurchasePayload({
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
    pluginId: "analytics-core",
    name: "analytics-core.graph-dry-run.order-access-token-issued",
    version: "v1",
    enabled: true,
    handler: async (event) => {
      if (!isGraphDryRunEnabled()) {
        return
      }

      if (event.payload.source === "store_order_recovery_verify") {
        return
      }

      const analytics = event.scope.resolve<AnalyticsCaptureService>(
        ANALYTICS_CORE_MODULE
      )

      await analytics.captureEvent({
        scope: event.scope,
        eventName: "order_access_claimed",
        source: "backend_hook",
        eventKey: `graph:order_access_claimed:${event.payload.orderId}:${event.payload.source}`,
        occurredAt: event.occurredAt,
        destinationCodes: [GRAPH_DRY_RUN_DESTINATION_CODE],
        orderId: event.payload.orderId,
        customerEmail: event.payload.customerEmail,
        payload: buildGraphDryRunOrderAccessPayload({
          eventName: "order_access_claimed",
          orderId: event.payload.orderId,
          payload: event.payload as unknown as Record<string, unknown>,
        }),
        metadata: {
          source_hook: "order_access.token_issued",
        },
      })
    },
  })

  hooksRegistered = true
}

export function resetGraphDryRunHooksForTests() {
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
