import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  emitDeliveryCompletedEvent,
  emitDeliveryCreatedEvent,
  emitPaymentAttemptFinalizedEvent,
} from "../events"
import {
  ensurePlatformObservabilityHooksRegistered,
  resetPlatformObservabilityForTests,
} from "../observability"
import {
  configurePlatformRuntime,
  resetPlatformRuntimeForTests,
} from "../runtime"

describe("platform observability hooks", () => {
  beforeEach(() => {
    resetPlatformRuntimeForTests()
    resetPlatformObservabilityForTests()
    configurePlatformRuntime({
      disabledPlugins: [
        "support-audit",
        "guest-order-access",
        "marketing-engine",
        "analytics-ga4",
      ],
    })
  })

  it("logs finalized payment events through the observability subscriber", async () => {
    const logger = {
      info: jest.fn(),
    }
    const container = {
      resolve: jest.fn((token: unknown) => {
        if (token === ContainerRegistrationKeys.LOGGER) {
          return logger
        }

        throw new Error(`Unexpected resolve token: ${String(token)}`)
      }),
    } as unknown as MedusaContainer

    ensurePlatformObservabilityHooksRegistered()

    await emitPaymentAttemptFinalizedEvent(container, {
      attempt: {
        id: "payatt_1",
      },
      orderId: "order_1",
    })

    expect(logger.info).toHaveBeenCalledWith(
      "Platform event: payment attempt finalized",
      expect.objectContaining({
        event: "payment_attempt.finalized",
        attempt_id: "payatt_1",
        order_id: "order_1",
      })
    )
  })

  it("logs delivery events through the observability subscriber", async () => {
    const logger = {
      info: jest.fn(),
    }
    const container = {
      resolve: jest.fn((token: unknown) => {
        if (token === ContainerRegistrationKeys.LOGGER) {
          return logger
        }

        throw new Error(`Unexpected resolve token: ${String(token)}`)
      }),
    } as unknown as MedusaContainer

    ensurePlatformObservabilityHooksRegistered()

    await emitDeliveryCreatedEvent(container, {
      delivery: {
        id: "delivery_1",
      },
      accessToken: "token_1",
      orderId: "order_1",
      metadata: {},
    })

    expect(logger.info).toHaveBeenCalledWith(
      "Platform event: delivery created",
      expect.objectContaining({
        event: "delivery.created",
        delivery_id: "delivery_1",
        order_id: "order_1",
        access_token_issued: true,
      })
    )
  })

  it("logs completed delivery events through the observability subscriber", async () => {
    const logger = {
      info: jest.fn(),
    }
    const container = {
      resolve: jest.fn((token: unknown) => {
        if (token === ContainerRegistrationKeys.LOGGER) {
          return logger
        }

        throw new Error(`Unexpected resolve token: ${String(token)}`)
      }),
    } as unknown as MedusaContainer

    ensurePlatformObservabilityHooksRegistered()

    await emitDeliveryCompletedEvent(container, {
      delivery: {
        id: "delivery_1",
      },
      accessToken: null,
      orderId: "order_1",
      metadata: {},
    })

    expect(logger.info).toHaveBeenCalledWith(
      "Platform event: delivery completed",
      expect.objectContaining({
        event: "delivery.completed",
        delivery_id: "delivery_1",
        order_id: "order_1",
        access_token_issued: false,
      })
    )
  })
})
