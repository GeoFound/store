import crypto from "crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, MedusaService, Modules } from "@medusajs/framework/utils"
import AnalyticsDispatch from "./models/analytics-dispatch"
import AnalyticsEvent from "./models/analytics-event"
import {
  getAnalyticsDispatchConfig,
  type AnalyticsDispatchConfig,
} from "./config"
import type {
  CaptureAnalyticsEventInput,
  ListAnalyticsDispatchesInput,
  ListAnalyticsEventsInput,
  ListDispatchesForDeliveryInput,
  MarkDispatchDeliveredInput,
  MarkDispatchFailedInput,
} from "./types"

class AnalyticsCoreModuleService extends MedusaService({
  AnalyticsEvent,
  AnalyticsDispatch,
}) {
  async captureEvent(input: CaptureAnalyticsEventInput) {
    const config = getAnalyticsDispatchConfig()

    if (!config.enabled) {
      return {
        event: null,
        dispatches: [] as Array<Record<string, unknown>>,
      }
    }

    const destinationCodes = normalizeDestinationCodes(input.destinationCodes)

    if (!destinationCodes.length) {
      return {
        event: null,
        dispatches: [] as Array<Record<string, unknown>>,
      }
    }

    const eventKey = toNullableText(input.eventKey)
    const runner = async () => this.captureEventInternal(input, destinationCodes, eventKey)

    if (eventKey && input.scope) {
      const locking = input.scope.resolve(Modules.LOCKING)

      return locking.execute(`analytics_event_key:${eventKey}`, runner, {
        timeout: 20,
      })
    }

    return runner()
  }

  async listDispatchesForDelivery(input: ListDispatchesForDeliveryInput) {
    const config = getAnalyticsDispatchConfig()
    const destinationCode = requireText(input.destinationCode, "destinationCode")
    const limit = normalizeLimit(input.limit, config.batchSize)
    const now = input.now || new Date()

    const pending = await this.listAnalyticsDispatches(
      {
        destination_code: destinationCode,
        status: "pending",
      },
      {
        take: limit,
        order: {
          created_at: "ASC",
        },
      }
    )

    if (pending.length >= limit) {
      return pending
    }

    const failed = await this.listAnalyticsDispatches(
      {
        destination_code: destinationCode,
        status: "failed",
      },
      {
        take: limit * 5,
        order: {
          updated_at: "ASC",
        },
      }
    )

    const dueFailed = failed.filter((dispatch) => {
      const retryAt = toDateOrNull(dispatch.next_retry_at)
      return !retryAt || retryAt.getTime() <= now.getTime()
    })

    return [...pending, ...dueFailed].slice(0, limit)
  }

  async markDispatchProcessing(dispatchId: string) {
    const dispatch = await this.retrieveAnalyticsDispatch(dispatchId)

    if (dispatch.status !== "pending" && dispatch.status !== "failed") {
      return dispatch
    }

    const updated = await this.updateAnalyticsDispatches({
      id: dispatch.id,
      status: "processing",
      attempt_count: Number(dispatch.attempt_count || 0) + 1,
      last_attempt_at: new Date(),
      error_message: null,
    })

    await this.refreshEventStatus(dispatch.event_id)

    return updated
  }

  async markDispatchDelivered(input: MarkDispatchDeliveredInput) {
    const dispatch = await this.retrieveAnalyticsDispatch(input.dispatchId)

    const updated = await this.updateAnalyticsDispatches({
      id: dispatch.id,
      status: "delivered",
      delivered_at: input.deliveredAt || new Date(),
      next_retry_at: null,
      error_message: null,
      response_status:
        typeof input.responseStatus === "number" ? input.responseStatus : null,
      response_body: toNullableText(input.responseBody),
    })

    await this.refreshEventStatus(dispatch.event_id)

    return updated
  }

  async markDispatchFailed(input: MarkDispatchFailedInput) {
    const dispatch = await this.retrieveAnalyticsDispatch(input.dispatchId)
    const config = getAnalyticsDispatchConfig()
    const attemptCount = Number(dispatch.attempt_count || 0)
    const failedAt = input.failedAt || new Date()

    const isDead = attemptCount >= config.maxRetryAttempts
    const retryAt = isDead
      ? null
      : new Date(
          failedAt.getTime() +
            this.calculateRetryDelaySeconds(attemptCount, config) * 1000
        )

    const updated = await this.updateAnalyticsDispatches({
      id: dispatch.id,
      status: isDead ? "dead" : "failed",
      next_retry_at: retryAt,
      error_message: trimTo(input.errorMessage, 1000) || "Dispatch failed",
      response_status:
        typeof input.responseStatus === "number" ? input.responseStatus : null,
      response_body: toNullableText(input.responseBody),
    })

    await this.refreshEventStatus(dispatch.event_id)

    return updated
  }

  async replayDispatch(input: { dispatchId: string }) {
    const dispatch = await this.retrieveAnalyticsDispatch(input.dispatchId)

    const updated = await this.updateAnalyticsDispatches({
      id: dispatch.id,
      status: "pending",
      next_retry_at: null,
      error_message: null,
      response_status: null,
      response_body: null,
    })

    await this.refreshEventStatus(dispatch.event_id)

    return updated
  }

  async listEventsSafe(input?: ListAnalyticsEventsInput) {
    const events = await this.listAnalyticsEvents(
      {
        ...(input?.eventName ? { event_name: input.eventName } : {}),
        ...(input?.source ? { source: input.source } : {}),
        ...(input?.status ? { status: input.status } : {}),
        ...(input?.orderId ? { order_id: input.orderId } : {}),
        ...(input?.paymentAttemptId
          ? { payment_attempt_id: input.paymentAttemptId }
          : {}),
      },
      {
        take: normalizeLimit(input?.limit, 100),
        order: {
          created_at: "DESC",
        },
      }
    )

    if (!input?.destinationCode) {
      return events
    }

    const destinationCode = input.destinationCode.trim()

    if (!destinationCode) {
      return events
    }

    const eventIds = events.map((event) => String(event.id))

    if (!eventIds.length) {
      return events
    }

    const dispatches = await this.listAnalyticsDispatches(
      {
        event_id: eventIds,
        destination_code: destinationCode,
      },
      {
        take: eventIds.length * 3,
      }
    )

    const eventIdsWithDestination = new Set(
      dispatches.map((dispatch) => String(dispatch.event_id))
    )

    return events.filter((event) => eventIdsWithDestination.has(String(event.id)))
  }

  async listDispatchesSafe(input?: ListAnalyticsDispatchesInput) {
    return this.listAnalyticsDispatches(
      {
        ...(input?.destinationCode
          ? { destination_code: input.destinationCode }
          : {}),
        ...(input?.status ? { status: input.status } : {}),
        ...(input?.eventId ? { event_id: input.eventId } : {}),
      },
      {
        take: normalizeLimit(input?.limit, 100),
        order: {
          created_at: "DESC",
        },
      }
    )
  }

  hashEmail(email?: string | null) {
    const normalized = normalizeEmail(email)

    if (!normalized) {
      return null
    }

    return crypto.createHash("sha256").update(normalized).digest("hex")
  }

  private async captureEventInternal(
    input: CaptureAnalyticsEventInput,
    destinationCodes: string[],
    eventKey: string | null
  ) {
    const existing = eventKey
      ? await this.findEventByKey(eventKey)
      : null

    if (existing) {
      const dispatches = await this.ensureDispatches(existing.id, destinationCodes)

      return {
        event: existing,
        dispatches,
      }
    }

    const event = await this.createAnalyticsEvents({
      event_name: requireText(input.eventName, "eventName"),
      source: input.source || "backend_hook",
      event_key: eventKey,
      status: "pending",
      occurred_at: toDateOrNow(input.occurredAt),
      cart_id: toNullableText(input.cartId),
      order_id: toNullableText(input.orderId),
      payment_attempt_id: toNullableText(input.paymentAttemptId),
      customer_email_hash: this.hashEmail(input.customerEmail),
      payload_json: normalizeRecord(input.payload),
      metadata_json: normalizeRecord(input.metadata),
    })

    const dispatches = await this.ensureDispatches(event.id, destinationCodes)

    await this.refreshEventStatus(event.id)

    return {
      event,
      dispatches,
    }
  }

  private async ensureDispatches(eventId: string, destinationCodes: string[]) {
    const normalizedCodes = normalizeDestinationCodes(destinationCodes)

    if (!normalizedCodes.length) {
      return []
    }

    const existing = await this.listAnalyticsDispatches(
      {
        event_id: eventId,
      },
      {
        take: normalizedCodes.length + 20,
      }
    )

    const existingCodes = new Set(
      existing.map((dispatch) => String(dispatch.destination_code))
    )

    const missing = normalizedCodes.filter((code) => !existingCodes.has(code))

    let created: Array<Record<string, unknown>> = []

    if (missing.length) {
      created = (await this.createAnalyticsDispatches(
        missing.map((code) => ({
          event_id: eventId,
          destination_code: code,
          status: "pending" as const,
          attempt_count: 0,
          last_attempt_at: null,
          next_retry_at: null,
          delivered_at: null,
          response_status: null,
          error_message: null,
          response_body: null,
          metadata_json: {},
        }))
      )) as Array<Record<string, unknown>>
    }

    return [...existing, ...created]
  }

  private async findEventByKey(eventKey: string) {
    const events = await this.listAnalyticsEvents(
      {
        event_key: eventKey,
      },
      {
        take: 1,
        order: {
          created_at: "DESC",
        },
      }
    )

    return events[0] || null
  }

  private async refreshEventStatus(eventId: string) {
    const dispatches = await this.listAnalyticsDispatches(
      {
        event_id: eventId,
      },
      {
        take: 500,
      }
    )

    if (!dispatches.length) {
      await this.updateAnalyticsEvents({
        id: eventId,
        status: "pending",
      })
      return
    }

    const statuses = dispatches.map((dispatch) => String(dispatch.status))

    let status: "pending" | "processing" | "delivered" | "failed" | "partial" =
      "pending"

    if (statuses.every((entry) => entry === "delivered")) {
      status = "delivered"
    } else if (statuses.some((entry) => entry === "processing")) {
      status = "processing"
    } else if (statuses.every((entry) => entry === "dead")) {
      status = "failed"
    } else if (
      statuses.some((entry) => entry === "failed" || entry === "dead") &&
      statuses.some((entry) => entry === "delivered")
    ) {
      status = "partial"
    } else if (statuses.some((entry) => entry === "failed" || entry === "dead")) {
      status = "failed"
    }

    await this.updateAnalyticsEvents({
      id: eventId,
      status,
    })
  }

  private calculateRetryDelaySeconds(
    attemptCount: number,
    config: AnalyticsDispatchConfig
  ) {
    const multiplier = Math.pow(2, Math.max(attemptCount - 1, 0))
    const seconds = config.retryBaseSeconds * multiplier

    return Math.min(seconds, config.retryMaxSeconds)
  }
}

export default AnalyticsCoreModuleService

function normalizeEmail(value?: string | null) {
  if (!value || typeof value !== "string") {
    return ""
  }

  const normalized = value.trim().toLowerCase()

  return normalized || ""
}

function normalizeDestinationCodes(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean)
    )
  )
}

function normalizeLimit(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback
  }

  return Math.max(1, Math.min(500, Math.floor(value)))
}

function requireText(value: unknown, field: string) {
  if (typeof value !== "string") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `${field} is required`)
  }

  const trimmed = value.trim()

  if (!trimmed) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `${field} is required`)
  }

  return trimmed.slice(0, 200)
}

function toNullableText(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()

  return trimmed ? trimmed.slice(0, 500) : null
}

function toDateOrNow(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value)

    if (Number.isFinite(parsed.getTime())) {
      return parsed
    }
  }

  return new Date()
}

function toDateOrNull(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value)

    if (Number.isFinite(parsed.getTime())) {
      return parsed
    }
  }

  return null
}

function trimTo(value: string, max: number) {
  const trimmed = value.trim()

  if (!trimmed) {
    return ""
  }

  return trimmed.length > max ? trimmed.slice(0, max) : trimmed
}

function normalizeRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null
}
