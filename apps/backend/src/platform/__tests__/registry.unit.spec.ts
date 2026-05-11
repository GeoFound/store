import {
  createPlatformRegistry,
} from "../registry"
import { discoverBuiltinPluginManifests } from "../discovery"
import {
  getDeliveryHandlerOrFallback,
  resolveProductFulfillmentPolicy,
} from "../delivery"
import {
  getPaymentProvider,
  getPaymentProviderOrFallback,
  registerPaymentProvider,
} from "../../modules/payment-router/providers/registry"
import {
  configurePlatformRuntime,
  emitPlatformHook,
  getPlatformRuntime,
  registerPlatformHook,
  resetPlatformRuntimeForTests,
} from "../runtime"
import { getInventoryHandler } from "../inventory"
import { getOrderAccessProvider } from "../order-access"

describe("platform registry", () => {
  beforeEach(() => {
    resetPlatformRuntimeForTests()
  })

  it("resolves registered contracts by name and priority", () => {
    const registry = createPlatformRegistry()

    registry.registerPlugin({
      manifest: {
        id: "plugin.one",
        version: "1.0.0",
        capabilities: ["payment-provider"],
        enabledByDefault: true,
      },
      contracts: [
        {
          capability: "payment-provider",
          name: "alpha",
          pluginId: "plugin.one",
          version: "v1",
          priority: 10,
          implementation: { code: "alpha" },
        },
        {
          capability: "payment-provider",
          name: "beta",
          pluginId: "plugin.one",
          version: "v1",
          priority: 20,
          implementation: { code: "beta" },
        },
      ],
    })

    expect(
      registry.resolveContract<{ code: string }>("payment-provider")?.code
    ).toBe("beta")
    expect(
      registry.resolveContract<{ code: string }>("payment-provider", "alpha")
        ?.code
    ).toBe("alpha")
  })

  it("respects scope and plugin enablement", () => {
    const registry = createPlatformRegistry()

    registry.registerPlugin({
      manifest: {
        id: "plugin.scoped",
        version: "1.0.0",
        capabilities: ["payment-provider"],
        enabledByDefault: true,
      },
      contracts: [
        {
          capability: "payment-provider",
          name: "scoped",
          pluginId: "plugin.scoped",
          version: "v1",
          scope: {
            siteIds: ["site-a"],
          },
          implementation: { code: "scoped" },
        },
      ],
    })

    expect(
      registry.resolveContract<{ code: string }>("payment-provider", "scoped", {
        siteId: "site-a",
      })?.code
    ).toBe("scoped")
    expect(
      registry.resolveContract<{ code: string }>("payment-provider", "scoped", {
        siteId: "site-b",
      })
    ).toBeUndefined()

    registry.setPluginEnabled("plugin.scoped", false)
    expect(
      registry.resolveContract<{ code: string }>("payment-provider", "scoped", {
        siteId: "site-a",
      })
    ).toBeUndefined()
  })

  it("supports same contract name across scoped registrations", () => {
    const registry = createPlatformRegistry()

    registry.registerPlugin({
      manifest: {
        id: "plugin.multi-scope",
        version: "1.0.0",
        capabilities: ["payment-provider"],
        enabledByDefault: true,
      },
      contracts: [
        {
          capability: "payment-provider",
          name: "manual",
          pluginId: "plugin.multi-scope",
          version: "v1",
          priority: 100,
          scope: {
            siteIds: ["site-a"],
          },
          implementation: { code: "manual-site-a" },
        },
        {
          capability: "payment-provider",
          name: "manual",
          pluginId: "plugin.multi-scope",
          version: "v1",
          priority: 90,
          scope: {
            siteIds: ["site-b"],
          },
          implementation: { code: "manual-site-b" },
        },
      ],
    })

    expect(registry.listContracts("payment-provider")).toHaveLength(2)
    expect(
      registry.resolveContract<{ code: string }>("payment-provider", "manual", {
        siteId: "site-a",
      })?.code
    ).toBe("manual-site-a")
    expect(
      registry.resolveContract<{ code: string }>("payment-provider", "manual", {
        siteId: "site-b",
      })?.code
    ).toBe("manual-site-b")
  })

  it("treats unknown plugins as disabled unless explicitly overridden", () => {
    const registry = createPlatformRegistry()

    expect(registry.isPluginEnabled("plugin.unknown")).toBe(false)
    expect(registry.setPluginEnabled("plugin.unknown", true)).toBe(false)
    expect(registry.isPluginEnabled("plugin.unknown")).toBe(true)
  })

  it("disables dependent plugin contracts when a required dependency is disabled", () => {
    const registry = createPlatformRegistry()

    registry.registerPlugin({
      manifest: {
        id: "plugin.core",
        version: "1.0.0",
        capabilities: [],
        enabledByDefault: true,
      },
    })

    registry.registerPlugin({
      manifest: {
        id: "plugin.dependent",
        version: "1.0.0",
        capabilities: ["payment-provider"],
        enabledByDefault: true,
        dependencies: [
          {
            id: "plugin.core",
          },
        ],
      },
      contracts: [
        {
          capability: "payment-provider",
          name: "dependent-provider",
          pluginId: "plugin.dependent",
          version: "v1",
          implementation: { code: "dependent-provider" },
        },
      ],
    })

    expect(registry.isPluginEnabled("plugin.dependent")).toBe(true)
    expect(
      registry.resolveContract<{ code: string }>(
        "payment-provider",
        "dependent-provider"
      )?.code
    ).toBe("dependent-provider")

    registry.setPluginEnabled("plugin.core", false)

    expect(registry.isPluginEnabled("plugin.dependent")).toBe(false)
    expect(
      registry.resolveContract<{ code: string }>(
        "payment-provider",
        "dependent-provider"
      )
    ).toBeUndefined()
  })

  it("registers built-ins and falls back to noop when requested", () => {
    getPlatformRuntime()

    expect(getPaymentProvider("manual")?.code).toBe("manual")
    expect(getPaymentProviderOrFallback("missing")?.code).toBe("noop")
  })

  it("discovers builtin plugin manifests", () => {
    const manifests = discoverBuiltinPluginManifests()

    expect(manifests.map((manifest) => manifest.id)).toContain("payment-router")
    expect(manifests.map((manifest) => manifest.id)).toContain("digital-delivery")
    expect(manifests.map((manifest) => manifest.id)).toContain(
      "credential-inventory"
    )
    expect(manifests.map((manifest) => manifest.id)).toContain(
      "guest-order-access"
    )
    expect(manifests.map((manifest) => manifest.id)).toContain("support-audit")
    expect(manifests.map((manifest) => manifest.id)).toContain(
      "marketing-engine"
    )
    expect(manifests.map((manifest) => manifest.id)).toContain("analytics-core")
    expect(manifests.map((manifest) => manifest.id)).toContain("analytics-ga4")
    expect(manifests.map((manifest) => manifest.id)).toContain(
      "analytics-hotjar"
    )
    expect(manifests.map((manifest) => manifest.id)).toContain(
      "platform.fallback"
    )
  })

  it("resolves default fulfillment policy and delivery fallback", async () => {
    expect(await resolveProductFulfillmentPolicy({
      productVariantId: "variant_1",
    })).toMatchObject({
      code: "default:credential",
      deliveryHandlerCode: "credential",
      inventoryHandlerCode: "credential-inventory",
      inventoryMode: "reserve",
    })
    expect(getDeliveryHandlerOrFallback("missing")?.code).toBe("noop")
  })

  it("routes no-inventory product types away from credential reservations", async () => {
    expect(await resolveProductFulfillmentPolicy({
      productVariantId: "variant_file",
      productType: "file",
    })).toMatchObject({
      code: "default:no-inventory",
      deliveryHandlerCode: "manual",
      inventoryHandlerCode: "noop",
      inventoryMode: "none",
    })
  })

  it("registers inventory, delivery, and order access capabilities by default", () => {
    getPlatformRuntime()

    expect(getInventoryHandler("credential-inventory")?.code).toBe(
      "credential-inventory"
    )
    expect(getDeliveryHandlerOrFallback("credential")?.code).toBe("credential")
    expect(getOrderAccessProvider("guest-order-access")?.code).toBe(
      "guest-order-access"
    )
  })

  it("skips hook subscribers when their plugin is disabled", async () => {
    configurePlatformRuntime({
      disabledPlugins: ["support-audit"],
    })
    const handler = jest.fn()

    registerPlatformHook({
      hook: "audit.log",
      pluginId: "support-audit",
      name: "support-audit.disabled-test",
      version: "1.0.0",
      handler,
    })

    await emitPlatformHook("audit.log", {
      action: "test",
    })

    expect(handler).not.toHaveBeenCalled()
  })

  it("skips hook subscribers when disabled by hook-subscriber contract", async () => {
    configurePlatformRuntime({
      disabledPlugins: ["support-audit"],
      disabledContracts: {
        "hook-subscriber": ["test.audit.hook"],
      },
    })
    const handler = jest.fn()

    registerPlatformHook({
      hook: "audit.log",
      pluginId: "plugin.hooks",
      name: "test.audit.hook",
      version: "1.0.0",
      handler,
    })

    await emitPlatformHook("audit.log", {
      action: "test",
    })

    expect(handler).not.toHaveBeenCalled()
  })

  it("supports runtime registration and replacement", () => {
    getPlatformRuntime()

    registerPaymentProvider(
      {
        code: "alt",
        createPayment: () => ({
          providerOrderId: "alt_1",
        }),
      } as never,
      {
        pluginId: "plugin.alt",
      }
    )

    expect(getPaymentProvider("alt")).toBeDefined()

    getPlatformRuntime().setPluginEnabled("plugin.alt", false)
    expect(getPaymentProvider("alt")).toBeUndefined()
    expect(getPaymentProviderOrFallback("alt")?.code).toBe("noop")
  })
})
