import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { resetPlatformRuntimeForTests } from "../../platform/runtime"
import {
  emitNotification,
  resetNotificationHooksForTests,
  sendGuestOrderRecoveryCode,
} from "../notification"

describe("notification hook subscriber", () => {
  beforeEach(() => {
    resetPlatformRuntimeForTests()
    resetNotificationHooksForTests()
  })

  it("routes generic notifications through the platform hook subscriber", async () => {
    const notificationModule = {
      createNotifications: jest.fn().mockResolvedValue({
        id: "notif_1",
      }),
    }
    const container = {
      resolve: jest.fn((token: unknown) => {
        if (token === Modules.NOTIFICATION) {
          return notificationModule
        }

        throw new Error(`Unexpected resolve token: ${String(token)}`)
      }),
    } as unknown as MedusaContainer

    await emitNotification(container, {
      to: "test@example.com",
      channel: "email",
      template: "guest-order-recovery",
      data: {
        order_id: "order_1",
      },
    })

    expect(notificationModule.createNotifications).toHaveBeenCalledWith({
      to: "test@example.com",
      channel: "email",
      template: "guest-order-recovery",
      data: {
        order_id: "order_1",
      },
    })
  })

  it("keeps guest order recovery as a semantic helper on top of notification hooks", async () => {
    const notificationModule = {
      createNotifications: jest.fn().mockResolvedValue({
        id: "notif_2",
      }),
    }
    const container = {
      resolve: jest.fn((token: unknown) => {
        if (token === Modules.NOTIFICATION) {
          return notificationModule
        }

        throw new Error(`Unexpected resolve token: ${String(token)}`)
      }),
    } as unknown as MedusaContainer

    await sendGuestOrderRecoveryCode(container, {
      email: "guest@example.com",
      orderId: "order_2",
      code: "ABC123",
      expiresAt: "2026-05-10T12:00:00.000Z",
    })

    expect(notificationModule.createNotifications).toHaveBeenCalledWith({
      to: "guest@example.com",
      channel: "email",
      template: "guest-order-recovery",
      data: {
        order_id: "order_2",
        code: "ABC123",
        expires_at: "2026-05-10T12:00:00.000Z",
      },
    })
  })
})
