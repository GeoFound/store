import type { BackendRuntimeContext } from "../../platform/backend-context"
import type { OrderAccessTokenIssuedEvent } from "../../platform/events"
import { PLATFORM_HOOKS } from "../../platform/hooks"
import { registerPlatformHook } from "../../platform/runtime"
import { SUPPORT_AUDIT_MODULE } from "."
import type { WriteAuditLogInput } from "./types"
import type SupportAuditModuleService from "./service"

export type AuditLogHookInput = WriteAuditLogInput & {
  scope: BackendRuntimeContext
}

let hooksRegistered = false

export function ensureSupportAuditHooksRegistered() {
  if (hooksRegistered) {
    return
  }

  registerPlatformHook<AuditLogHookInput>({
    hook: PLATFORM_HOOKS.auditLog,
    pluginId: "support-audit",
    name: "support-audit.write-audit-log",
    version: "1.0.0",
    enabled: true,
    handler: async (input) => {
      const supportAudit: SupportAuditModuleService = input.scope.resolve(
        SUPPORT_AUDIT_MODULE
      )

      await supportAudit.writeAuditLog({
        actorType: input.actorType,
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        riskLevel: input.riskLevel,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadata: input.metadata,
      })
    },
  })

  registerPlatformHook<OrderAccessTokenIssuedEvent>({
    hook: PLATFORM_HOOKS.orderAccessTokenIssued,
    pluginId: "support-audit",
    name: "support-audit.order-access-token-issued",
    version: "1.0.0",
    enabled: true,
    handler: async (event) => {
      const supportAudit: SupportAuditModuleService = event.scope.resolve(
        SUPPORT_AUDIT_MODULE
      )

      await supportAudit.writeAuditLog({
        actorType: event.payload.actorType,
        action:
          event.payload.source === "store_order_recovery_verify"
            ? "order.recovery_verified"
            : "order_access.claimed",
        entityType: "order",
        entityId: event.payload.orderId,
        riskLevel: "high",
        ipAddress: event.payload.ipAddress,
        userAgent: event.payload.userAgent,
        metadata: {
          source: event.payload.source,
          purpose: event.payload.purpose,
          ...(event.payload.metadata || {}),
        },
      })
    },
  })

  hooksRegistered = true
}

export function resetSupportAuditHooksForTests() {
  hooksRegistered = false
}
