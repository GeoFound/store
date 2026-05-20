import { manualPaymentProvider } from "../modules/payment-router/providers/manual"
import { credentialInventoryHandler } from "../modules/credential-inventory/handler"
import { credentialDeliveryHandler } from "../modules/credential-inventory/delivery-handler"
import { manualDeliveryHandler } from "../modules/digital-delivery/handler"
import { guestOrderAccessProvider } from "../modules/guest-order-access/provider"
import { g2aSupplierProvider } from "../modules/supplier-g2a/provider"
import { reloadlySupplierProvider } from "../modules/supplier-reloadly/provider"
import { supplierProcurementDeliveryHandler } from "../modules/supplier-procurement/delivery-handler"
import { externalApiFulfillmentPolicy } from "../modules/supplier-procurement/product-policy"
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
import type { SupplierProvider } from "./supplier"
import {
  BUILTIN_NOOP_PROVIDER_PLUGIN_ID,
  CREDENTIAL_INVENTORY_PLUGIN_MANIFEST,
  DIGITAL_DELIVERY_PLUGIN_MANIFEST,
  GUEST_ORDER_ACCESS_PLUGIN_MANIFEST,
  PAYMENT_ROUTER_PLUGIN_MANIFEST,
  PLATFORM_CORE_PLUGIN_MANIFESTS,
  PLATFORM_DELIVERY_NOOP_PLUGIN_ID,
  PLATFORM_DELIVERY_NOOP_PLUGIN_MANIFEST,
  PLATFORM_INVENTORY_NOOP_PLUGIN_ID,
  PLATFORM_INVENTORY_NOOP_PLUGIN_MANIFEST,
  PLATFORM_MARKETING_NOOP_PLUGIN_ID,
  PLATFORM_MARKETING_NOOP_PLUGIN_MANIFEST,
  PLATFORM_ORDER_ACCESS_NOOP_PLUGIN_ID,
  PLATFORM_ORDER_ACCESS_NOOP_PLUGIN_MANIFEST,
  PLATFORM_PAYMENT_NOOP_PLUGIN_MANIFEST,
  PLATFORM_PRODUCT_POLICY_DEFAULT_PLUGIN_ID,
  PLATFORM_PRODUCT_POLICY_DEFAULT_PLUGIN_MANIFEST,
  SUPPLIER_G2A_PLUGIN_MANIFEST,
  SUPPLIER_PROCUREMENT_PLUGIN_MANIFEST,
  SUPPLIER_RELOADLY_PLUGIN_MANIFEST,
} from "./builtin"
import {
  type PlatformRegistry,
  createPlatformRegistry,
} from "./registry"

export function registerDefaultPlatformCapabilities(
  registry: PlatformRegistry = createPlatformRegistry()
) {
  for (const manifest of PLATFORM_CORE_PLUGIN_MANIFESTS) {
    if (manifest.id === PAYMENT_ROUTER_PLUGIN_MANIFEST.id) {
      continue
    }

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
    manifest: PLATFORM_INVENTORY_NOOP_PLUGIN_MANIFEST,
    contracts: [
      {
        capability: "inventory-handler",
        name: "noop",
        pluginId: PLATFORM_INVENTORY_NOOP_PLUGIN_ID,
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
    manifest: PLATFORM_DELIVERY_NOOP_PLUGIN_MANIFEST,
    contracts: [
      {
        capability: "delivery-handler",
        name: "noop",
        pluginId: PLATFORM_DELIVERY_NOOP_PLUGIN_ID,
        version: "v1",
        priority: 0,
        enabled: true,
        implementation: createNoopDeliveryHandler(),
      },
    ],
  })

  registry.registerPlugin<DeliveryHandler>({
    manifest: {
      ...SUPPLIER_PROCUREMENT_PLUGIN_MANIFEST,
      title: "Supplier Procurement Delivery Handler",
      description:
        "External supplier procurement and delivery record creation capability.",
    },
    contracts: [
      {
        capability: "delivery-handler",
        name: supplierProcurementDeliveryHandler.code,
        pluginId: SUPPLIER_PROCUREMENT_PLUGIN_MANIFEST.id,
        version: "v1",
        priority: 100,
        enabled: true,
        implementation: supplierProcurementDeliveryHandler,
      },
    ],
  })

  registry.registerPlugin<ProductFulfillmentPolicy>({
    manifest: PLATFORM_PRODUCT_POLICY_DEFAULT_PLUGIN_MANIFEST,
    contracts: [
      {
        capability: "product-policy",
        name: "default",
        pluginId: PLATFORM_PRODUCT_POLICY_DEFAULT_PLUGIN_ID,
        version: "v1",
        priority: 0,
        enabled: true,
        implementation: createDefaultFulfillmentPolicy(),
      },
    ],
  })

  registry.registerPlugin<ProductFulfillmentPolicy>({
    manifest: {
      ...SUPPLIER_PROCUREMENT_PLUGIN_MANIFEST,
      title: "External API Fulfillment Policy",
      description:
        "No-inventory fulfillment policy for supplier-backed external API products.",
    },
    contracts: [
      {
        capability: "product-policy",
        name: externalApiFulfillmentPolicy.code,
        pluginId: SUPPLIER_PROCUREMENT_PLUGIN_MANIFEST.id,
        version: "v1",
        priority: 100,
        enabled: true,
        implementation: externalApiFulfillmentPolicy,
      },
    ],
  })

  registry.registerPlugin<SupplierProvider>({
    manifest: SUPPLIER_RELOADLY_PLUGIN_MANIFEST,
    contracts: [
      {
        capability: "supplier-provider",
        name: reloadlySupplierProvider.code,
        pluginId: SUPPLIER_RELOADLY_PLUGIN_MANIFEST.id,
        version: "v1",
        priority: 100,
        enabled: true,
        implementation: reloadlySupplierProvider,
        description: "Reloadly gift card, airtime, and data bundle provider.",
      },
    ],
  })

  registry.registerPlugin<SupplierProvider>({
    manifest: SUPPLIER_G2A_PLUGIN_MANIFEST,
    contracts: [
      {
        capability: "supplier-provider",
        name: g2aSupplierProvider.code,
        pluginId: SUPPLIER_G2A_PLUGIN_MANIFEST.id,
        version: "v1",
        priority: 90,
        enabled: true,
        implementation: g2aSupplierProvider,
        description: "G2A Export API provider.",
      },
    ],
  })

  registry.registerPlugin<MarketingStrategy>({
    manifest: PLATFORM_MARKETING_NOOP_PLUGIN_MANIFEST,
    contracts: [
      {
        capability: "marketing-strategy",
        name: "noop",
        pluginId: PLATFORM_MARKETING_NOOP_PLUGIN_ID,
        version: "v1",
        priority: -1000,
        enabled: true,
        implementation: createNoopMarketingStrategy(),
      },
    ],
  })

  registry.registerPlugin<PaymentProvider>({
    manifest: PLATFORM_PAYMENT_NOOP_PLUGIN_MANIFEST,
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
    manifest: PLATFORM_ORDER_ACCESS_NOOP_PLUGIN_MANIFEST,
    contracts: [
      {
        capability: "order-access-provider",
        name: "noop",
        pluginId: PLATFORM_ORDER_ACCESS_NOOP_PLUGIN_ID,
        version: "v1",
        priority: 0,
        enabled: true,
        implementation: createNoopOrderAccessProvider(),
      },
    ],
  })

  return registry
}
