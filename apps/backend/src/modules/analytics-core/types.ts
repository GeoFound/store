import type { BackendRuntimeContext } from "../../platform/backend-context"

export type AnalyticsEventSource = "backend_hook" | "storefront" | "system"

export type AnalyticsDispatchStatus =
  | "pending"
  | "processing"
  | "delivered"
  | "failed"
  | "dead"

export type AnalyticsEventStatus =
  | "pending"
  | "processing"
  | "delivered"
  | "failed"
  | "partial"

export type CaptureAnalyticsEventInput = {
  scope?: BackendRuntimeContext
  eventName: string
  source?: AnalyticsEventSource
  eventKey?: string | null
  occurredAt?: string | Date | null
  cartId?: string | null
  orderId?: string | null
  paymentAttemptId?: string | null
  customerEmail?: string | null
  payload?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  destinationCodes: string[]
}

export type ListDispatchesForDeliveryInput = {
  destinationCode: string
  limit?: number
  now?: Date
}

export type MarkDispatchFailedInput = {
  dispatchId: string
  errorMessage: string
  responseStatus?: number | null
  responseBody?: string | null
  failedAt?: Date
}

export type MarkDispatchDeliveredInput = {
  dispatchId: string
  responseStatus?: number | null
  responseBody?: string | null
  deliveredAt?: Date
}

export type ListAnalyticsEventsInput = {
  eventName?: string
  source?: AnalyticsEventSource
  status?: AnalyticsEventStatus
  destinationCode?: string
  orderId?: string
  paymentAttemptId?: string
  limit?: number
}

export type ListAnalyticsDispatchesInput = {
  destinationCode?: string
  status?: AnalyticsDispatchStatus
  eventId?: string
  limit?: number
}
