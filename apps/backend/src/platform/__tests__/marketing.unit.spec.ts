import {
  configurePlatformRuntime,
  resetPlatformRuntimeForTests,
} from "../runtime"
import {
  emitMarketingAttemptClosed,
  emitMarketingAttemptPaid,
  registerMarketingStrategy,
  resolveMarketingContext,
} from "../marketing"

describe("marketing strategy runtime", () => {
  beforeEach(() => {
    resetPlatformRuntimeForTests()
    configurePlatformRuntime()
  })

  it("resolves marketing context patches from registered strategies", async () => {
    registerMarketingStrategy(
      {
        code: "test-utm",
        resolve: () => ({
          attribution: {
            source: "newsletter",
          },
          tags: ["utm"],
        }),
      },
      {
        pluginId: "marketing-engine",
        priority: 100,
      }
    )

    const resolved = await resolveMarketingContext({
      scope: {} as never,
      attemptId: "pat_1",
      cartId: "cart_1",
      amount: 100,
      currency: "usd",
      customerEmail: "buyer@example.com",
      context: {},
      resolved: {},
    })

    expect(resolved.attribution?.source).toBe("newsletter")
    expect(resolved.tags).toContain("utm")
  })

  it("skips strategies from disabled plugins", async () => {
    configurePlatformRuntime({
      disabledPlugins: ["marketing-engine"],
    })

    const resolveSpy = jest.fn()
    registerMarketingStrategy(
      {
        code: "disabled-strategy",
        resolve: resolveSpy,
      },
      {
        pluginId: "marketing-engine",
      }
    )

    await resolveMarketingContext({
      scope: {} as never,
      attemptId: "pat_1",
      cartId: "cart_1",
      amount: 100,
      currency: "usd",
      customerEmail: "buyer@example.com",
      context: {},
      resolved: {},
    })

    expect(resolveSpy).not.toHaveBeenCalled()
  })

  it("dispatches paid and closed callbacks", async () => {
    const paidSpy = jest.fn()
    const closedSpy = jest.fn()

    registerMarketingStrategy(
      {
        code: "callback-strategy",
        onAttemptPaid: paidSpy,
        onAttemptClosed: closedSpy,
      },
      {
        pluginId: "marketing-engine",
      }
    )

    await emitMarketingAttemptPaid({
      scope: {} as never,
      attemptId: "pat_1",
      orderId: "order_1",
      customerEmail: "buyer@example.com",
      context: {},
    })

    await emitMarketingAttemptClosed({
      scope: {} as never,
      attemptId: "pat_1",
      customerEmail: "buyer@example.com",
      context: {},
    })

    expect(paidSpy).toHaveBeenCalledTimes(1)
    expect(closedSpy).toHaveBeenCalledTimes(1)
  })

  it("executes strategies by descending priority", async () => {
    const executed: string[] = []

    registerMarketingStrategy(
      {
        code: "low-priority",
        resolve: () => {
          executed.push("low")
          return null
        },
      },
      {
        pluginId: "marketing-engine",
        priority: 10,
      }
    )

    registerMarketingStrategy(
      {
        code: "high-priority",
        resolve: () => {
          executed.push("high")
          return null
        },
      },
      {
        pluginId: "marketing-engine",
        priority: 200,
      }
    )

    await resolveMarketingContext({
      scope: {} as never,
      attemptId: "pat_1",
      cartId: "cart_1",
      amount: 100,
      currency: "usd",
      customerEmail: "buyer@example.com",
      context: {},
      resolved: {},
    })

    expect(executed).toEqual(["high", "low"])
  })
})
