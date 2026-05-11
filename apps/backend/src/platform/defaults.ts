import { PAYMENT_ROUTER_PLUGIN_MANIFEST } from "../modules/payment-router/plugin"
import { DIGITAL_DELIVERY_PLUGIN_MANIFEST } from "../modules/digital-delivery/plugin"
import { CREDENTIAL_INVENTORY_PLUGIN_MANIFEST } from "../modules/credential-inventory/plugin"
import { GUEST_ORDER_ACCESS_PLUGIN_MANIFEST } from "../modules/guest-order-access/plugin"
import { SUPPORT_AUDIT_PLUGIN_MANIFEST } from "../modules/support-audit/plugin"
import { MARKETING_ENGINE_PLUGIN_MANIFEST } from "../modules/marketing-engine/plugin"
import { ANALYTICS_CORE_PLUGIN_MANIFEST } from "../modules/analytics-core/plugin"
import { ANALYTICS_GA4_PLUGIN_MANIFEST } from "../modules/analytics-ga4/plugin"
import { ANALYTICS_HOTJAR_PLUGIN_MANIFEST } from "../modules/analytics-hotjar/plugin"
import { manualPaymentProvider } from "../modules/payment-router/providers/manual"
import { credentialInventoryHandler } from "../modules/credential-inventory/handler"
import { credentialDeliveryHandler } from "../modules/credential-inventory/delivery-handler"
import { manualDeliveryHandler } from "../modules/digital-delivery/handler"
import { guestOrderAccessProvider } from "../modules/guest-order-access/provider"
import type { PaymentProvider } from "../modules/payment-router/providers/types"
import {
  createDefaultFulfillmentPolicy,
  createNoopPaymentProvider,
  createNoopMarketingStrategy,
  createNoopDeliveryHandler,
  createNoopInventoryHandler,
  createNoopOrderAccessProvider,
} from "./fallbacks"
import type { DeliveryHandler, ProductFulfillmentPolicy } from "./delivery"
import type { InventoryHandler } from "./inventory"
import type { MarketingStrategy } from "./marketing"
import type { OrderAccessProvider } from "./order-access"
import {
  type PlatformRegistry,
  createPlatformRegistry,
} from "./registry"

export const BUILTIN_NOOP_PROVIDER_PLUGIN_ID = "builtin.payment-provider.noop"

export function registerDefaultPlatformCapabilities(
  registry: PlatformRegistry = createPlatformRegistry()
) {
  for (const manifest of [
    DIGITAL_DELIVERY_PLUGIN_MANIFEST,
    CREDENTIAL_INVENTORY_PLUGIN_MANIFEST,
    GUEST_ORDER_ACCESS_PLUGIN_MANIFEST,
    SUPPORT_AUDIT_PLUGIN_MANIFEST,
    MARKETING_ENGINE_PLUGIN_MANIFEST,
    ANALYTICS_CORE_PLUGIN_MANIFEST,
    ANALYTICS_GA4_PLUGIN_MANIFEST,
    ANALYTICS_HOTJAR_PLUGIN_MANIFEST,
  ]) {
    registry.registerPlugin({
      manifest,
    })
  }

  registry.registerPlugin<PaymentProvider>({
    manifest: {
      ...PAYMENT_ROUTER_PLUGIN_MANIFEST,
      title: "Manual Payment Provider",
      description: "Built-in manual payment capability.",
    },
    contracts: [
      {
        capability: "payment-provider",
        name: manualPaymentProvider.code,
        pluginId: PAYMENT_ROUTER_PLUGIN_MANIFEST.id,
        version: "v1",
        priority: 100,
        enabled: true,
        implementation: manualPaymentProvider,
      },
    ],
  })

  registry.registerPlugin<InventoryHandler>({
    manifest: {
      ...CREDENTIAL_INVENTORY_PLUGIN_MANIFEST,
      title: "Credential Inventory Handler",
      description: "Encrypted credential inventory reservation capability.",
    },
    contracts: [
      {
        capability: "inventory-handler",
        name: credentialInventoryHandler.code,
        pluginId: CREDENTIAL_INVENTORY_PLUGIN_MANIFEST.id,
        version: "v1",
        priority: 100,
        enabled: true,
        implementation: credentialInventoryHandler,
      },
    ],
  })

  registry.registerPlugin<InventoryHandler>({
    manifest: {
      id: "platform.inventory.noop",
      version: "1.0.0",
      capabilities: ["inventory-handler"],
      enabledByDefault: true,
      migrationsOwner: "platform",
      title: "No-op Inventory Handler",
      description: "Fallback inventory capability for products without stock reservations.",
    },
    contracts: [
      {
        capability: "inventory-handler",
        name: "noop",
        pluginId: "platform.inventory.noop",
        version: "v1",
        priority: 0,
        enabled: true,
        implementation: createNoopInventoryHandler(),
      },
    ],
  })

  registry.registerPlugin<DeliveryHandler>({
    manifest: {
      ...DIGITAL_DELIVERY_PLUGIN_MANIFEST,
      title: "Manual Delivery Handler",
      description: "Manual digital delivery record creation capability.",
    },
    contracts: [
      {
        capability: "delivery-handler",
        name: manualDeliveryHandler.code,
        pluginId: DIGITAL_DELIVERY_PLUGIN_MANIFEST.id,
        version: "v1",
        priority: 100,
        enabled: true,
        implementation: manualDeliveryHandler,
      },
    ],
  })

  registry.registerPlugin<DeliveryHandler>({
    manifest: {
      ...CREDENTIAL_INVENTORY_PLUGIN_MANIFEST,
      title: "Credential Delivery Handler",
      description: "Credential reveal and delivery bridge capability.",
    },
    contracts: [
      {
        capability: "delivery-handler",
        name: credentialDeliveryHandler.code,
        pluginId: CREDENTIAL_INVENTORY_PLUGIN_MANIFEST.id,
        version: "v1",
        priority: 100,
        enabled: true,
        implementation: credentialDeliveryHandler,
      },
    ],
  })

  registry.registerPlugin<DeliveryHandler>({
    manifest: {
      id: "platform.delivery.noop",
      version: "1.0.0",
      capabilities: ["delivery-handler"],
      enabledByDefault: true,
      migrationsOwner: "platform",
      title: "No-op Delivery Handler",
      description: "Fallback delivery capability.",
    },
    contracts: [
      {
        capability: "delivery-handler",
        name: "noop",
        pluginId: "platform.delivery.noop",
        version: "v1",
        priority: 0,
        enabled: true,
        implementation: createNoopDeliveryHandler(),
      },
    ],
  })

  registry.registerPlugin<ProductFulfillmentPolicy>({
    manifest: {
      id: "platform.product-policy.default",
      version: "1.0.0",
      capabilities: ["product-policy"],
      enabledByDefault: true,
      migrationsOwner: "platform",
      title: "Default Fulfillment Policy",
      description: "Fallback product fulfillment policy.",
    },
    contracts: [
      {
        capability: "product-policy",
        name: "default",
        pluginId: "platform.product-policy.default",
        version: "v1",
        priority: 0,
        enabled: true,
        implementation: createDefaultFulfillmentPolicy(),
      },
    ],
  })

  registry.registerPlugin<MarketingStrategy>({
    manifest: {
      id: "platform.marketing.noop",
      version: "1.0.0",
      capabilities: ["marketing-strategy"],
      enabledByDefault: true,
      migrationsOwner: "platform",
      title: "No-op Marketing Strategy",
      description:
        "Fallback strategy so marketing capability can be safely disabled or replaced.",
    },
    contracts: [
      {
        capability: "marketing-strategy",
        name: "noop",
        pluginId: "platform.marketing.noop",
        version: "v1",
        priority: -1000,
        enabled: true,
        implementation: createNoopMarketingStrategy(),
      },
    ],
  })

  registry.registerPlugin<PaymentProvider>({
    manifest: {
      id: BUILTIN_NOOP_PROVIDER_PLUGIN_ID,
      version: "1.0.0",
      capabilities: ["payment-provider"],
      enabledByDefault: true,
      migrationsOwner: "platform",
      title: "No-op Payment Provider",
      description: "Fallback adapter for disabled or missing payment providers.",
    },
    contracts: [
      {
        capability: "payment-provider",
        name: "noop",
        pluginId: BUILTIN_NOOP_PROVIDER_PLUGIN_ID,
        version: "v1",
        priority: 0,
        enabled: true,
        implementation: createNoopPaymentProvider(),
      },
    ],
  })

  registry.registerPlugin<OrderAccessProvider>({
    manifest: {
      ...GUEST_ORDER_ACCESS_PLUGIN_MANIFEST,
      title: "Guest Order Access Provider",
      description: "Guest order access and recovery token capability.",
    },
    contracts: [
      {
        capability: "order-access-provider",
        name: guestOrderAccessProvider.code,
        pluginId: GUEST_ORDER_ACCESS_PLUGIN_MANIFEST.id,
        version: "v1",
        priority: 100,
        enabled: true,
        implementation: guestOrderAccessProvider,
      },
    ],
  })

  registry.registerPlugin<OrderAccessProvider>({
    manifest: {
      id: "platform.order-access.noop",
      version: "1.0.0",
      capabilities: ["order-access-provider"],
      enabledByDefault: true,
      migrationsOwner: "platform",
      title: "No-op Order Access Provider",
      description: "Fallback adapter for optional order-access side effects.",
    },
    contracts: [
      {
        capability: "order-access-provider",
        name: "noop",
        pluginId: "platform.order-access.noop",
        version: "v1",
        priority: 0,
        enabled: true,
        implementation: createNoopOrderAccessProvider(),
      },
    ],
  })

  return registry
}
