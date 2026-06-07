import type { MedusaContainer } from "@medusajs/framework/types"
import { SUPPORT_AUDIT_MODULE } from ".."
import { emitOrderAccessTokenIssuedEvent } from "../../../platform/events"
import {
  ensureSupportAuditHooksRegistered,
  resetSupportAuditHooksForTests,
} from "../hooks"
import {
  configurePlatformRuntime,
  resetPlatformRuntimeForTests,
} from "../../../platform/runtime"
import { emitAuditLog } from "../../../utils/audit-log"

describe("support audit hook subscriber", () => {
  beforeEach(() => {
    resetPlatformRuntimeForTests()
    resetSupportAuditHooksForTests()
    configurePlatformRuntime({
      disabledPlugins: [
        "platform.observability",
        "guest-order-access",
        "marketing-engine",
        "analytics-ga4",
      ],
    })
  })

  it("routes audit log emission through the support-audit hook subscriber", async () => {
    const supportAudit = {
      writeAuditLog: jest.fn().mockResolvedValue({
        id: "audit_1",
      }),
    }
    const container = {
      resolve: jest.fn((token: unknown) => {
        if (token === SUPPORT_AUDIT_MODULE) {
          return supportAudit
        }

        throw new Error(`Unexpected resolve token: ${String(token)}`)
      }),
    } as unknown as MedusaContainer

    ensureSupportAuditHooksRegistered()

    await emitAuditLog(container, {
      actorType: "admin",
      actorId: "user_1",
      action: "payment_attempt.mark_paid",
      entityType: "payment_attempt",
      entityId: "payatt_1",
      riskLevel: "high",
      ipAddress: "127.0.0.1",
      userAgent: "jest",
      metadata: {
        order_id: "order_1",
      },
    })

    expect(supportAudit.writeAuditLog).toHaveBeenCalledWith({
      actorType: "admin",
      actorId: "user_1",
      action: "payment_attempt.mark_paid",
      entityType: "payment_attempt",
      entityId: "payatt_1",
      riskLevel: "high",
      ipAddress: "127.0.0.1",
      userAgent: "jest",
      metadata: {
        order_id: "order_1",
      },
    })
  })

  it("subscribes to order access token domain events for audit logging", async () => {
    const supportAudit = {
      writeAuditLog: jest.fn().mockResolvedValue({
        id: "audit_2",
      }),
    }
    const container = {
      resolve: jest.fn((token: unknown) => {
        if (token === SUPPORT_AUDIT_MODULE) {
          return supportAudit
        }

        throw new Error(`Unexpected resolve token: ${String(token)}`)
      }),
    } as unknown as MedusaContainer

    ensureSupportAuditHooksRegistered()

    await emitOrderAccessTokenIssuedEvent(container, {
      orderId: "order_2",
      customerEmail: "guest@example.com",
      purpose: "view_order",
      source: "payment_attempt_claim",
      actorType: "guest",
      ipAddress: "127.0.0.1",
      userAgent: "jest",
      metadata: {
        payment_attempt_id: "payatt_1",
      },
    })

    expect(supportAudit.writeAuditLog).toHaveBeenCalledWith({
      actorType: "guest",
      action: "order_access.claimed",
      entityType: "order",
      entityId: "order_2",
      riskLevel: "high",
      ipAddress: "127.0.0.1",
      userAgent: "jest",
      metadata: {
        source: "payment_attempt_claim",
        purpose: "view_order",
        payment_attempt_id: "payatt_1",
      },
    })
  })
})
