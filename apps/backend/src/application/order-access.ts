export type StorefrontOrderRecoveryInput = {
  orderId?: string | null
  email?: string | null
  locale?: string | null
  audit?: StorefrontOrderAccessAuditContext
}

export type StorefrontOrderRecoveryVerifyInput = {
  orderId?: string | null
  code?: string | null
  audit?: StorefrontOrderAccessAuditContext
}

export type StorefrontOrderAccessAuditContext = {
  ipAddress?: string
  userAgent?: string
}

export type StorefrontOrderIdentity = {
  id: string
  email: string
}

export type StorefrontRecoveryCode = {
  token: string
  record: {
    id: string
    expires_at?: unknown
  }
}

export type StorefrontOrderRecoveryResult = {
  order_id: string
  expires_at: unknown
}

export type StorefrontOrderRecoveryVerifyResult = {
  order_id: string
  access_token: string
}

export type StorefrontOrderAccessRepository = {
  isGuestOrderAccessAvailable(): boolean
  retrieveOrderIdentity(orderId: string): Promise<StorefrontOrderIdentity | null>
  createRecoveryCode(input: {
    lockKey: string
    orderId: string
    customerEmail: string
    metadata?: Record<string, unknown>
  }): Promise<StorefrontRecoveryCode>
  revokeRecoveryCode(recordId: string): Promise<void>
  emitRecoveryCodeCreated(input: {
    orderId: string
    customerEmail: string
    code: string
    expiresAt?: string | null
    locale?: string | null
  }): Promise<void>
  verifyRecoveryCodeAndIssueViewToken(input: {
    lockKey: string
    orderId: string
    customerEmail: string
    code: string
    metadata?: Record<string, unknown>
  }): Promise<{ token: string }>
  emitOrderAccessTokenIssued(input: {
    orderId: string
    customerEmail: string
    purpose: "view_order"
    source: string
    actorType: "guest"
    ipAddress?: string
    userAgent?: string
    metadata?: Record<string, unknown>
  }): Promise<void>
  writeAuditLog(input: StorefrontOrderAccessAuditLogInput): Promise<void>
}

export type StorefrontOrderAccessAuditLogInput = {
  actorType: "guest" | "system"
  action: string
  entityType: string
  entityId: string
  riskLevel: "low" | "medium" | "high"
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}

export type OrderAccessApplicationErrorCode =
  | "invalid_request"
  | "guest_unavailable"
  | "order_not_found"
  | "provider_unavailable"
  | "recovery_cooldown"
  | "recovery_notification_failed"

export class OrderAccessApplicationError extends Error {
  readonly code: OrderAccessApplicationErrorCode
  readonly cause?: unknown

  constructor(
    code: OrderAccessApplicationErrorCode,
    message: string,
    input?: { cause?: unknown }
  ) {
    super(message)
    this.name = "OrderAccessApplicationError"
    this.code = code
    this.cause = input?.cause
  }
}

export function isOrderAccessApplicationError(
  error: unknown,
  code?: OrderAccessApplicationErrorCode
): error is OrderAccessApplicationError {
  return (
    error instanceof OrderAccessApplicationError &&
    (typeof code === "undefined" || error.code === code)
  )
}

export type StorefrontOrderAccessApplication = {
  requestRecoveryCode(
    input: StorefrontOrderRecoveryInput
  ): Promise<StorefrontOrderRecoveryResult>
  verifyRecoveryCode(
    input: StorefrontOrderRecoveryVerifyInput
  ): Promise<StorefrontOrderRecoveryVerifyResult>
}

export function createStorefrontOrderAccessApplication(
  repository: StorefrontOrderAccessRepository
): StorefrontOrderAccessApplication {
  return {
    async requestRecoveryCode(input) {
      if (!repository.isGuestOrderAccessAvailable()) {
        throw new OrderAccessApplicationError(
          "guest_unavailable",
          "Guest order access is unavailable"
        )
      }

      const orderId = requiredText(input.orderId, "order id")
      const requestedEmail = normalizeEmail(input.email)
      const order = await repository.retrieveOrderIdentity(orderId)

      if (!order || normalizeEmail(order.email) !== requestedEmail) {
        throw new OrderAccessApplicationError(
          "order_not_found",
          "Order was not found"
        )
      }

      const normalizedEmail = normalizeEmail(order.email)
      const lockKey = `order-recovery-request:${order.id}:${normalizedEmail}`
      const recovery = await repository.createRecoveryCode({
        lockKey,
        orderId: order.id,
        customerEmail: order.email,
        metadata: {
          source: "store_order_recovery",
        },
      })

      try {
        await repository.emitRecoveryCodeCreated({
          orderId: order.id,
          customerEmail: order.email,
          code: recovery.token,
          expiresAt: serializeDateLike(recovery.record.expires_at),
          locale: optionalText(input.locale) || null,
        })
      } catch (error) {
        await repository.revokeRecoveryCode(String(recovery.record.id))

        try {
          await repository.writeAuditLog({
            actorType: "system",
            action: "order.recovery_notification_failed",
            entityType: "order",
            entityId: order.id,
            riskLevel: "high",
            ipAddress: input.audit?.ipAddress,
            userAgent: input.audit?.userAgent,
            metadata: {
              customer_email: normalizedEmail,
              recovery_token_id: String(recovery.record.id),
              error: error instanceof Error ? error.message : String(error),
            },
          })
        } catch {
          // Preserve the recovery notification failure for the caller.
        }

        throw new OrderAccessApplicationError(
          "recovery_notification_failed",
          "Recovery code could not be sent. Please try again.",
          { cause: error }
        )
      }

      await repository.writeAuditLog({
        actorType: "guest",
        action: "order.recovery_requested",
        entityType: "order",
        entityId: order.id,
        riskLevel: "medium",
        ipAddress: input.audit?.ipAddress,
        userAgent: input.audit?.userAgent,
        metadata: {
          customer_email: normalizedEmail,
        },
      })

      return {
        order_id: order.id,
        expires_at: recovery.record.expires_at || null,
      }
    },

    async verifyRecoveryCode(input) {
      const orderId = requiredText(input.orderId, "order id")
      const code = requiredText(input.code, "recovery code")
      const order = await repository.retrieveOrderIdentity(orderId)

      if (!order) {
        throw new OrderAccessApplicationError(
          "order_not_found",
          "Order was not found"
        )
      }

      const lockKey = `order-recovery:${order.id}:${normalizeEmail(order.email)}`
      const issued = await repository.verifyRecoveryCodeAndIssueViewToken({
        lockKey,
        orderId: order.id,
        customerEmail: order.email,
        code,
        metadata: {
          source: "store_order_recovery_verify",
        },
      })

      await repository.emitOrderAccessTokenIssued({
        orderId: order.id,
        customerEmail: order.email,
        purpose: "view_order",
        source: "store_order_recovery_verify",
        actorType: "guest",
        ipAddress: input.audit?.ipAddress,
        userAgent: input.audit?.userAgent,
        metadata: {
          recovery_code_verified: true,
        },
      })

      return {
        order_id: order.id,
        access_token: issued.token,
      }
    },
  }
}

function requiredText(value: unknown, label: string) {
  const text = optionalText(value)

  if (!text) {
    throw new OrderAccessApplicationError(
      "invalid_request",
      `${label} is required`
    )
  }

  return text
}

function optionalText(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return undefined
  }

  const text = String(value).trim()

  return text || undefined
}

function normalizeEmail(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
}

function serializeDateLike(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString()
  }

  return value ? String(value) : ""
}
