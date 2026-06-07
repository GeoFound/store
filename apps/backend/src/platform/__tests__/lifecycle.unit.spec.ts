import type { PluginRegistration } from "../contracts"
import "../../platform-adapters/integrations"
import {
  configurePlatformRuntime,
  getPlatformRuntime,
  installPlatformPlugin,
  parsePlatformRuntimeOptionsFromEnv,
  removePlatformPlugin,
  replacePlatformPlugin,
  resetPlatformRuntimeForTests,
} from "../runtime"
import type { PaymentProvider } from "../payment-providers"
import { getPaymentProvider } from "../payment-providers"

describe("platform lifecycle", () => {
  beforeEach(() => {
    resetPlatformRuntimeForTests()
  })

  it("applies plugin and contract disable overrides before later registration", () => {
    configurePlatformRuntime({
      disabledPlugins: ["plugin.alt"],
      disabledContracts: {
        "payment-provider": ["alt"],
      },
    })

    installPlatformPlugin(
      createProviderPlugin({
        pluginId: "plugin.alt",
        code: "alt",
        providerOrderId: "alt_1",
      })
    )

    expect(getPaymentProvider("alt")).toBeUndefined()
  })

  it("supports install and remove without guessing removed providers", () => {
    configurePlatformRuntime()

    installPlatformPlugin(
      createProviderPlugin({
        pluginId: "plugin.lifecycle",
        code: "lifecycle",
        providerOrderId: "life_1",
      })
    )

    expect(
      getPaymentProvider("lifecycle")?.createPayment(createPaymentInput())
    ).toMatchObject({
      providerOrderId: "life_1",
    })

    expect(removePlatformPlugin("plugin.lifecycle")).toBe(true)
    expect(getPaymentProvider("lifecycle")).toBeUndefined()
  })

  it("replaces a plugin implementation and rolls back on invalid replacement", () => {
    configurePlatformRuntime()

    installPlatformPlugin(
      createProviderPlugin({
        pluginId: "plugin.swap",
        code: "swap",
        providerOrderId: "swap_v1",
      })
    )

    replacePlatformPlugin(
      createProviderPlugin({
        pluginId: "plugin.swap",
        code: "swap",
        providerOrderId: "swap_v2",
      })
    )

    expect(
      getPaymentProvider("swap")?.createPayment(createPaymentInput())
    ).toMatchObject({
      providerOrderId: "swap_v2",
    })

    expect(() =>
      replacePlatformPlugin(
        createProviderPlugin({
          pluginId: "plugin.swap",
          code: "swap",
          providerOrderId: "swap_broken",
          contractVersion: "v2",
        })
      )
    ).toThrow(/unsupported version/)

    expect(
      getPaymentProvider("swap")?.createPayment(createPaymentInput())
    ).toMatchObject({
      providerOrderId: "swap_v2",
    })
  })

  it("rejects missing required dependencies during install", () => {
    configurePlatformRuntime({
      includeDefaults: false,
    })

    expect(() =>
      installPlatformPlugin(
        createProviderPlugin({
          pluginId: "plugin.dep",
          code: "dep",
          providerOrderId: "dep_1",
          dependencies: [
            {
              id: "payment-router",
            },
          ],
        })
      )
    ).toThrow(/requires dependency "payment-router"/)
  })

  it("parses runtime env configuration for plugin and contract toggles", () => {
    expect(
      parsePlatformRuntimeOptionsFromEnv({
        PLATFORM_ENABLED_PLUGINS: "plugin.a,plugin.b",
        PLATFORM_DISABLED_PLUGINS: "plugin.c",
        PLATFORM_ENABLED_CONTRACTS:
          "payment-provider:manual,alt;delivery-handler:manual",
        PLATFORM_DISABLED_CONTRACTS:
          "payment-provider:noop;hook-subscriber:support-audit",
      })
    ).toEqual({
      enabledPlugins: ["plugin.a", "plugin.b"],
      disabledPlugins: ["plugin.c"],
      enabledContracts: {
        "payment-provider": ["manual", "alt"],
        "delivery-handler": ["manual"],
      },
      disabledContracts: {
        "payment-provider": ["noop"],
        "hook-subscriber": ["support-audit"],
      },
    })
  })

  it("merges duplicate capability contract entries from env", () => {
    expect(
      parsePlatformRuntimeOptionsFromEnv({
        PLATFORM_ENABLED_CONTRACTS:
          "payment-provider:manual;payment-provider:alt,manual;delivery-handler:manual",
      })
    ).toEqual({
      enabledPlugins: undefined,
      disabledPlugins: undefined,
      enabledContracts: {
        "payment-provider": ["manual", "alt"],
        "delivery-handler": ["manual"],
      },
      disabledContracts: undefined,
    })
  })

  it("trims capability names while parsing contract env entries", () => {
    expect(
      parsePlatformRuntimeOptionsFromEnv({
        PLATFORM_ENABLED_CONTRACTS:
          " payment-provider : manual ; delivery-handler : noop ",
      })
    ).toEqual({
      enabledPlugins: undefined,
      disabledPlugins: undefined,
      enabledContracts: {
        "payment-provider": ["manual"],
        "delivery-handler": ["noop"],
      },
      disabledContracts: undefined,
    })
  })

  it("rejects unsupported contract capabilities from env", () => {
    expect(() =>
      parsePlatformRuntimeOptionsFromEnv({
        PLATFORM_ENABLED_CONTRACTS: "missing-capability:manual",
      })
    ).toThrow(
      'PLATFORM_ENABLED_CONTRACTS contains unsupported capability "missing-capability"'
    )
  })

  it("rejects contract env entries without contract names", () => {
    expect(() =>
      parsePlatformRuntimeOptionsFromEnv({
        PLATFORM_DISABLED_CONTRACTS: "payment-provider:",
      })
    ).toThrow(
      'PLATFORM_DISABLED_CONTRACTS entry "payment-provider" must include at least one contract name'
    )
  })

  it("keeps backend plugin env isolated from public storefront toggles", () => {
    expect(
      parsePlatformRuntimeOptionsFromEnv({
        PLATFORM_ENABLED_PLUGINS: "plugin.a,plugin.b",
        NEXT_PUBLIC_PLATFORM_ENABLED_PLUGINS: "plugin.b,plugin.c",
        PLATFORM_DISABLED_PLUGINS: "plugin.x",
        NEXT_PUBLIC_PLATFORM_DISABLED_PLUGINS: "plugin.x,plugin.y",
      })
    ).toEqual({
      enabledPlugins: ["plugin.a", "plugin.b"],
      disabledPlugins: ["plugin.x"],
      enabledContracts: undefined,
      disabledContracts: undefined,
    })
  })

  it("captures and restores full runtime snapshots", () => {
    const runtime = configurePlatformRuntime()

    installPlatformPlugin(
      createProviderPlugin({
        pluginId: "plugin.snapshot",
        code: "snapshot",
        providerOrderId: "snap_1",
      })
    )

    const snapshot = runtime.snapshot()

    removePlatformPlugin("plugin.snapshot")
    expect(getPaymentProvider("snapshot")).toBeUndefined()

    getPlatformRuntime().restore(snapshot)

    expect(
      getPaymentProvider("snapshot")?.createPayment(createPaymentInput())
    ).toMatchObject({
      providerOrderId: "snap_1",
    })
  })
})

function createProviderPlugin(input: {
  pluginId: string
  code: string
  providerOrderId: string
  contractVersion?: string
  dependencies?: PluginRegistration<PaymentProvider>["manifest"]["dependencies"]
}): PluginRegistration<PaymentProvider> {
  const provider: PaymentProvider = {
    code: input.code,
    createPayment: () => ({
      providerOrderId: input.providerOrderId,
    }),
  }

  return {
    manifest: {
      id: input.pluginId,
      version: "1.0.0",
      capabilities: ["payment-provider"],
      enabledByDefault: true,
      dependencies: input.dependencies,
    },
    contracts: [
      {
        capability: "payment-provider",
        name: provider.code,
        pluginId: input.pluginId,
        version: input.contractVersion || "v1",
        priority: 50,
        implementation: provider,
      },
    ],
  }
}

function createPaymentInput() {
  return {
    cartId: "cart_1",
    amount: 100,
    currency: "usd",
    paymentMethod: "manual",
  }
}
