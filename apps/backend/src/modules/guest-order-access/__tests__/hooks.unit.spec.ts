import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { emitOrderAccessRecoveryCodeCreatedEvent } from "../../../platform/events"
import {
  ensurePlatformObservabilityHooksRegistered,
  resetPlatformObservabilityForTests,
} from "../../../platform/observability"
import { resetPlatformRuntimeForTests } from "../../../platform/runtime"
import {
  ensureGuestOrderAccessHooksRegistered,
  resetGuestOrderAccessHooksForTests,
} from "../hooks"
import { resetNotificationHooksForTests } from "../../../utils/notification"

describe("guest order access hooks", () => {
  beforeEach(() => {
    resetPlatformRuntimeForTests()
    resetPlatformObservabilityForTests()
    resetGuestOrderAccessHooksForTests()
    resetNotificationHooksForTests()
  })

  it("sends recovery code notifications from the recovery-created domain event", async () => {
    const notificationModule = {
      createNotifications: jest.fn().mockResolvedValue({
        id: "notif_1",
      }),
    }
    const logger = {
      info: jest.fn(),
    }
    const container = {
      resolve: jest.fn((token: unknown) => {
        if (token === Modules.NOTIFICATION) {
          return notificationModule
        }

        if (token === ContainerRegistrationKeys.LOGGER) {
          return logger
        }

        throw new Error(`Unexpected resolve token: ${String(token)}`)
      }),
    } as unknown as MedusaContainer

    ensureGuestOrderAccessHooksRegistered()
    ensurePlatformObservabilityHooksRegistered()

    await emitOrderAccessRecoveryCodeCreatedEvent(container, {
      orderId: "order_1",
      customerEmail: "guest@example.com",
      code: "CODE123",
      expiresAt: "2026-05-10T12:00:00.000Z",
    })

    expect(notificationModule.createNotifications).toHaveBeenCalledWith({
      to: "guest@example.com",
      channel: "email",
      template: "guest-order-recovery",
      data: {
        order_id: "order_1",
        code: "CODE123",
        expires_at: "2026-05-10T12:00:00.000Z",
      },
    })
    expect(logger.info).toHaveBeenCalledWith(
      "Platform event: order access recovery code created",
      expect.objectContaining({
        event: "order_access.recovery_code_created",
        order_id: "order_1",
        customer_email: "guest@example.com",
      })
    )
  })
})
