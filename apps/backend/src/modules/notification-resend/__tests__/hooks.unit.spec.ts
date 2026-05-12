import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import { resetPlatformRuntimeForTests } from "../../../platform/runtime"
import {
  resetNotificationHooksForTests,
  sendGuestOrderRecoveryCode,
} from "../../../utils/notification"
import { resetNotificationResendHooksForTests } from "../hooks"

describe("notification resend hook subscriber", () => {
  const originalEnv = process.env
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.resetAllMocks()
    process.env = {
      ...originalEnv,
    }
    resetPlatformRuntimeForTests()
    resetNotificationHooksForTests()
    resetNotificationResendHooksForTests()
    global.fetch = jest.fn() as unknown as typeof fetch
  })

  afterAll(() => {
    process.env = originalEnv
    global.fetch = originalFetch
  })

  it("does not call Resend when the feature is disabled", async () => {
    process.env.RESEND_ENABLED = "false"

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

    await sendGuestOrderRecoveryCode(container, {
      email: "guest@example.com",
      orderId: "order_1",
      code: "ABC123",
      expiresAt: "2026-05-10T12:00:00.000Z",
    })

    expect(notificationModule.createNotifications).toHaveBeenCalledTimes(1)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("dispatches recovery emails through Resend when enabled", async () => {
    process.env.RESEND_ENABLED = "true"
    process.env.RESEND_API_KEY = "re_test_api_key"
    process.env.RESEND_FROM_EMAIL = "Store <no-reply@example.com>"
    process.env.RESEND_REPLY_TO_EMAIL = "support@example.com"

    ;(global.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "resend_msg_1",
      }),
    })

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

    await sendGuestOrderRecoveryCode(container, {
      email: "buyer@example.com",
      orderId: "order_2",
      code: "CODE42",
      expiresAt: "2026-05-10T12:00:00.000Z",
    })

    expect(notificationModule.createNotifications).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledTimes(1)

    const [url, request] = (global.fetch as unknown as jest.Mock).mock.calls[0]
    expect(url).toBe("https://api.resend.com/emails")
    expect(request).toMatchObject({
      method: "POST",
      headers: {
        Authorization: "Bearer re_test_api_key",
        "Content-Type": "application/json",
      },
    })

    const requestBody = JSON.parse(String(request.body))
    expect(requestBody).toMatchObject({
      from: "Store <no-reply@example.com>",
      to: ["buyer@example.com"],
      subject: "Order recovery code for order_2",
      reply_to: ["support@example.com"],
    })
  })

  it("fails fast when enabled but missing required Resend settings", async () => {
    process.env.RESEND_ENABLED = "true"
    delete process.env.RESEND_API_KEY
    process.env.RESEND_FROM_EMAIL = "no-reply@example.com"

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

    await expect(
      sendGuestOrderRecoveryCode(container, {
        email: "buyer@example.com",
        orderId: "order_3",
        code: "CODE99",
      })
    ).rejects.toThrow("RESEND_API_KEY is required when RESEND_ENABLED=true")
  })
})
