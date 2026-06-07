import {
  createPlatformRegistry,
} from "../registry"
import { discoverBuiltinPluginManifests } from "../../platform-adapters/discovery"
import "../../platform-adapters/integrations"
import {
  getDeliveryHandler,
  resolveProductFulfillmentPolicy,
} from "../delivery"
import {
  getPaymentProvider,
  listPaymentProviders,
  registerPaymentProvider,
} from "../payment-providers"
import { handlePaymentAttemptClosed } from "../attempt-lifecycle"
import { PLATFORM_HOOKS } from "../hooks"
import {
  configurePlatformRuntime,
  emitPlatformHook,
  getPlatformRuntime,
  registerPlatformHook,
  resetPlatformRuntimeForTests,
} from "../runtime"
import { getInventoryHandler } from "../inventory"
import { getOrderAccessProvider } from "../order-access"
import { getSupplierProvider } from "../supplier"

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

  it("requires matching context for scoped contracts and normalizes scope values", () => {
    const registry = createPlatformRegistry()

    registry.registerPlugin({
      manifest: {
        id: "plugin.normalized-scope",
        version: "1.0.0",
        capabilities: ["payment-provider"],
        enabledByDefault: true,
      },
      contracts: [
        {
          capability: "payment-provider",
          name: "scoped",
          pluginId: "plugin.normalized-scope",
          version: "v1",
          scope: {
            siteIds: [" site-a ", "site-a"],
            productTypeCodes: [" credential "],
          },
          implementation: { code: "scoped" },
        },
      ],
    })

    expect(
      registry.resolveContract<{ code: string }>("payment-provider", "scoped")
    ).toBeUndefined()
    expect(
      registry.resolveContract<{ code: string }>("payment-provider", "scoped", {
        siteId: " site-a ",
        productTypeCode: " credential ",
      })?.code
    ).toBe("scoped")
    expect(registry.listContracts("payment-provider")[0]?.scope).toEqual({
      siteIds: ["site-a"],
      productTypeCodes: ["credential"],
    })
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

  it("registers built-ins without guessing missing payment providers", () => {
    getPlatformRuntime()

    expect(getPaymentProvider("manual")?.code).toBe("manual")
    expect(getPaymentProvider("missing")).toBeUndefined()
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
    expect(manifests.map((manifest) => manifest.id)).toContain(
      "notification-resend"
    )
    expect(manifests.map((manifest) => manifest.id)).toContain("analytics-core")
    expect(manifests.map((manifest) => manifest.id)).toContain("analytics-ga4")
    expect(manifests.map((manifest) => manifest.id)).toContain(
      "analytics-hotjar"
    )
    expect(manifests.map((manifest) => manifest.id)).toContain(
      "supplier-procurement"
    )
    expect(manifests.map((manifest) => manifest.id)).toContain(
      "supplier-reloadly"
    )
    expect(manifests.map((manifest) => manifest.id)).toContain("supplier-g2a")
    expect(manifests.map((manifest) => manifest.id)).toContain(
      "platform.inventory.noop"
    )
    expect(manifests.map((manifest) => manifest.id)).toContain(
      "platform.delivery.noop"
    )
    expect(manifests.map((manifest) => manifest.id)).toContain(
      "platform.product-policy.default"
    )
    expect(manifests.map((manifest) => manifest.id)).toContain(
      "platform.marketing.noop"
    )
    expect(manifests.map((manifest) => manifest.id)).toContain(
      "builtin.payment-provider.noop"
    )
    expect(manifests.map((manifest) => manifest.id)).toContain(
      "platform.order-access.noop"
    )
  })

  it("resolves default fulfillment policy without guessing missing delivery handlers", async () => {
    expect(await resolveProductFulfillmentPolicy({
      productVariantId: "variant_1",
    })).toMatchObject({
      code: "default:credential",
      deliveryHandlerCode: "credential",
      inventoryHandlerCode: "credential-inventory",
      inventoryMode: "reserve",
    })
    expect(getDeliveryHandler("missing")).toBeUndefined()
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

  it("registers supplier procurement capabilities by default", async () => {
    getPlatformRuntime()

    expect(getSupplierProvider("reloadly")?.code).toBe("reloadly")
    expect(getSupplierProvider("g2a")?.code).toBe("g2a")
    expect(getDeliveryHandler("supplier-procurement")?.code).toBe(
      "supplier-procurement"
    )
    expect(await resolveProductFulfillmentPolicy({
      code: "external-api",
      productVariantId: "variant_api",
      productType: "api",
    })).toMatchObject({
      code: "external-api:supplier-procurement",
      deliveryHandlerCode: "supplier-procurement",
      inventoryHandlerCode: "noop",
      inventoryMode: "none",
    })
  })

  it("registers inventory, delivery, and order access capabilities by default", () => {
    getPlatformRuntime()

    expect(getInventoryHandler("credential-inventory")?.code).toBe(
      "credential-inventory"
    )
    expect(getDeliveryHandler("credential")?.code).toBe("credential")
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
  })

  it("emits payment attempt closed as a platform hook without default integrations", async () => {
    configurePlatformRuntime({
      includeDefaults: false,
    })
    const handler = jest.fn()

    registerPlatformHook({
      hook: PLATFORM_HOOKS.paymentAttemptClosed,
      pluginId: "plugin.closed",
      name: "plugin.closed.payment-attempt-closed",
      version: "v1",
      handler,
    })

    await handlePaymentAttemptClosed({} as never, {
      attemptId: "payatt_1",
      customerEmail: "buyer@example.com",
      reason: "provider_failed",
      payload: {
        marketing_context: {
          tags: ["test"],
        },
      },
    })

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        name: PLATFORM_HOOKS.paymentAttemptClosed,
        payload: expect.objectContaining({
          attemptId: "payatt_1",
          reason: "provider_failed",
        }),
      })
    )
    expect(
      getPlatformRuntime()
        .listContracts("hook-subscriber")
        .map((contract) => contract.name)
    ).not.toContain("marketing-engine.payment-attempt-closed")
  })

  it("lists payment providers using the provided resolution context", () => {
    configurePlatformRuntime({
      includeDefaults: false,
    })

    registerPaymentProvider(
      {
        code: "global-pay",
        createPayment: () => ({
          providerOrderId: "global_1",
        }),
      },
      {
        pluginId: "plugin.global-pay",
        priority: 10,
      }
    )
    registerPaymentProvider(
      {
        code: "site-pay",
        createPayment: () => ({
          providerOrderId: "site_1",
        }),
      },
      {
        pluginId: "plugin.site-pay",
        priority: 20,
        scope: {
          siteIds: ["site-a"],
        },
      }
    )

    expect(listPaymentProviders().map((provider) => provider.code)).toEqual([
      "global-pay",
    ])
    expect(
      listPaymentProviders({ siteId: "site-a" }).map((provider) => provider.code)
    ).toEqual(["site-pay", "global-pay"])
  })
})
