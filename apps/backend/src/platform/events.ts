import type { MedusaContainer } from "@medusajs/framework/types"
import { PLATFORM_HOOKS } from "./hooks"
import { emitPlatformHook } from "./runtime"

export type PlatformEventEnvelope<TName extends string, TPayload> = {
  scope: MedusaContainer
  name: TName
  occurredAt: string
  payload: TPayload
}

export type PaymentAttemptReservedEvent = PlatformEventEnvelope<
  typeof PLATFORM_HOOKS.paymentAttemptReserved,
  {
    attempt: Record<string, unknown>
    inventoryReservations: Array<{
      reservation_key: string
      item_ids: string[]
    }>
    fulfillmentItems?: Array<Record<string, unknown>>
    claimToken: string
    responsePayload: Record<string, unknown>
  }
>

export type PaymentAttemptFinalizedEvent = PlatformEventEnvelope<
  typeof PLATFORM_HOOKS.paymentAttemptFinalized,
  {
    attempt: Record<string, unknown>
    orderId: string
  }
>

export type DeliveryCreatedEvent = PlatformEventEnvelope<
  typeof PLATFORM_HOOKS.deliveryCreated,
  {
    delivery: Record<string, unknown>
    accessToken: string | null
    orderId?: string
    metadata: Record<string, unknown>
  }
>

export type DeliveryCompletedEvent = PlatformEventEnvelope<
  typeof PLATFORM_HOOKS.deliveryCompleted,
  {
    delivery: Record<string, unknown>
    accessToken: string | null
    orderId?: string
    metadata: Record<string, unknown>
  }
>

export type OrderAccessRecoveryCodeCreatedEvent = PlatformEventEnvelope<
  typeof PLATFORM_HOOKS.orderAccessRecoveryCodeCreated,
  {
    orderId: string
    customerEmail: string
    code: string
    expiresAt?: string | null
    locale?: string | null
  }
>

export type OrderAccessTokenIssuedEvent = PlatformEventEnvelope<
  typeof PLATFORM_HOOKS.orderAccessTokenIssued,
  {
    orderId: string
    customerEmail: string
    purpose: "view_order" | "claim_order"
    source: string
    actorType: "guest" | "customer" | "system"
    ipAddress?: string
    userAgent?: string
    metadata?: Record<string, unknown>
  }
>

export async function emitPaymentAttemptReservedEvent(
  scope: MedusaContainer,
  payload: PaymentAttemptReservedEvent["payload"]
) {
  await emitPlatformHook<PaymentAttemptReservedEvent>(
    PLATFORM_HOOKS.paymentAttemptReserved,
    {
      scope,
      name: PLATFORM_HOOKS.paymentAttemptReserved,
      occurredAt: new Date().toISOString(),
      payload,
    }
  )
}

export async function emitPaymentAttemptFinalizedEvent(
  scope: MedusaContainer,
  payload: PaymentAttemptFinalizedEvent["payload"]
) {
  await emitPlatformHook<PaymentAttemptFinalizedEvent>(
    PLATFORM_HOOKS.paymentAttemptFinalized,
    {
      scope,
      name: PLATFORM_HOOKS.paymentAttemptFinalized,
      occurredAt: new Date().toISOString(),
      payload,
    }
  )
}

export async function emitDeliveryCreatedEvent(
  scope: MedusaContainer,
  payload: DeliveryCreatedEvent["payload"]
) {
  await emitPlatformHook<DeliveryCreatedEvent>(PLATFORM_HOOKS.deliveryCreated, {
    scope,
    name: PLATFORM_HOOKS.deliveryCreated,
    occurredAt: new Date().toISOString(),
    payload,
  })
}

export async function emitDeliveryCompletedEvent(
  scope: MedusaContainer,
  payload: DeliveryCompletedEvent["payload"]
) {
  await emitPlatformHook<DeliveryCompletedEvent>(
    PLATFORM_HOOKS.deliveryCompleted,
    {
      scope,
      name: PLATFORM_HOOKS.deliveryCompleted,
      occurredAt: new Date().toISOString(),
      payload,
    }
  )
}

export async function emitOrderAccessRecoveryCodeCreatedEvent(
  scope: MedusaContainer,
  payload: OrderAccessRecoveryCodeCreatedEvent["payload"]
) {
  await emitPlatformHook<OrderAccessRecoveryCodeCreatedEvent>(
    PLATFORM_HOOKS.orderAccessRecoveryCodeCreated,
    {
      scope,
      name: PLATFORM_HOOKS.orderAccessRecoveryCodeCreated,
      occurredAt: new Date().toISOString(),
      payload,
    }
  )
}

export async function emitOrderAccessTokenIssuedEvent(
  scope: MedusaContainer,
  payload: OrderAccessTokenIssuedEvent["payload"]
) {
  await emitPlatformHook<OrderAccessTokenIssuedEvent>(
    PLATFORM_HOOKS.orderAccessTokenIssued,
    {
      scope,
      name: PLATFORM_HOOKS.orderAccessTokenIssued,
      occurredAt: new Date().toISOString(),
      payload,
    }
  )
}
