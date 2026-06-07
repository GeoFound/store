import type {
  AnalyticsEventSource,
  CaptureAnalyticsEventInput,
} from "../../platform/analytics"

export type { AnalyticsEventSource, CaptureAnalyticsEventInput }

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
