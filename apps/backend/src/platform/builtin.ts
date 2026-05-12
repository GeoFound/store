import { ANALYTICS_CORE_PLUGIN_MANIFEST } from "../modules/analytics-core/plugin"
import { ANALYTICS_GA4_PLUGIN_MANIFEST } from "../modules/analytics-ga4/plugin"
import { ANALYTICS_HOTJAR_PLUGIN_MANIFEST } from "../modules/analytics-hotjar/plugin"
import { CREDENTIAL_INVENTORY_PLUGIN_MANIFEST } from "../modules/credential-inventory/plugin"
import { DIGITAL_DELIVERY_PLUGIN_MANIFEST } from "../modules/digital-delivery/plugin"
import { GUEST_ORDER_ACCESS_PLUGIN_MANIFEST } from "../modules/guest-order-access/plugin"
import { MARKETING_ENGINE_PLUGIN_MANIFEST } from "../modules/marketing-engine/plugin"
import { NOTIFICATION_RESEND_PLUGIN_MANIFEST } from "../modules/notification-resend/plugin"
import { PAYMENT_ROUTER_PLUGIN_MANIFEST } from "../modules/payment-router/plugin"
import { SECURITY_GUARD_PLUGIN_MANIFEST } from "../modules/security-guard/plugin"
import { SUPPORT_AUDIT_PLUGIN_MANIFEST } from "../modules/support-audit/plugin"
import type { PluginManifest } from "./contracts"

export {
  ANALYTICS_CORE_PLUGIN_MANIFEST,
  ANALYTICS_GA4_PLUGIN_MANIFEST,
  ANALYTICS_HOTJAR_PLUGIN_MANIFEST,
  CREDENTIAL_INVENTORY_PLUGIN_MANIFEST,
  DIGITAL_DELIVERY_PLUGIN_MANIFEST,
  GUEST_ORDER_ACCESS_PLUGIN_MANIFEST,
  MARKETING_ENGINE_PLUGIN_MANIFEST,
  NOTIFICATION_RESEND_PLUGIN_MANIFEST,
  PAYMENT_ROUTER_PLUGIN_MANIFEST,
  SECURITY_GUARD_PLUGIN_MANIFEST,
  SUPPORT_AUDIT_PLUGIN_MANIFEST,
}

export const BUILTIN_NOOP_PROVIDER_PLUGIN_ID = "builtin.payment-provider.noop"
export const PLATFORM_INVENTORY_NOOP_PLUGIN_ID = "platform.inventory.noop"
export const PLATFORM_DELIVERY_NOOP_PLUGIN_ID = "platform.delivery.noop"
export const PLATFORM_PRODUCT_POLICY_DEFAULT_PLUGIN_ID =
  "platform.product-policy.default"
export const PLATFORM_MARKETING_NOOP_PLUGIN_ID = "platform.marketing.noop"
export const PLATFORM_ORDER_ACCESS_NOOP_PLUGIN_ID = "platform.order-access.noop"

export const PLATFORM_INVENTORY_NOOP_PLUGIN_MANIFEST: PluginManifest = {
  id: PLATFORM_INVENTORY_NOOP_PLUGIN_ID,
  version: "1.0.0",
  capabilities: ["inventory-handler"],
  enabledByDefault: true,
  migrationsOwner: "platform",
  title: "No-op Inventory Handler",
  description: "Fallback inventory capability for products without stock reservations.",
}

export const PLATFORM_DELIVERY_NOOP_PLUGIN_MANIFEST: PluginManifest = {
  id: PLATFORM_DELIVERY_NOOP_PLUGIN_ID,
  version: "1.0.0",
  capabilities: ["delivery-handler"],
  enabledByDefault: true,
  migrationsOwner: "platform",
  title: "No-op Delivery Handler",
  description: "Fallback delivery capability.",
}

export const PLATFORM_PRODUCT_POLICY_DEFAULT_PLUGIN_MANIFEST: PluginManifest = {
  id: PLATFORM_PRODUCT_POLICY_DEFAULT_PLUGIN_ID,
  version: "1.0.0",
  capabilities: ["product-policy"],
  enabledByDefault: true,
  migrationsOwner: "platform",
  title: "Default Fulfillment Policy",
  description: "Fallback product fulfillment policy.",
}

export const PLATFORM_MARKETING_NOOP_PLUGIN_MANIFEST: PluginManifest = {
  id: PLATFORM_MARKETING_NOOP_PLUGIN_ID,
  version: "1.0.0",
  capabilities: ["marketing-strategy"],
  enabledByDefault: true,
  migrationsOwner: "platform",
  title: "No-op Marketing Strategy",
  description:
    "Fallback strategy so marketing capability can be safely disabled or replaced.",
}

export const PLATFORM_PAYMENT_NOOP_PLUGIN_MANIFEST: PluginManifest = {
  id: BUILTIN_NOOP_PROVIDER_PLUGIN_ID,
  version: "1.0.0",
  capabilities: ["payment-provider"],
  enabledByDefault: true,
  migrationsOwner: "platform",
  title: "No-op Payment Provider",
  description: "Fallback adapter for disabled or missing payment providers.",
}

export const PLATFORM_ORDER_ACCESS_NOOP_PLUGIN_MANIFEST: PluginManifest = {
  id: PLATFORM_ORDER_ACCESS_NOOP_PLUGIN_ID,
  version: "1.0.0",
  capabilities: ["order-access-provider"],
  enabledByDefault: true,
  migrationsOwner: "platform",
  title: "No-op Order Access Provider",
  description: "Fallback adapter for optional order-access side effects.",
}

export const PLATFORM_CORE_PLUGIN_MANIFESTS: PluginManifest[] = [
  PAYMENT_ROUTER_PLUGIN_MANIFEST,
  SECURITY_GUARD_PLUGIN_MANIFEST,
  DIGITAL_DELIVERY_PLUGIN_MANIFEST,
  CREDENTIAL_INVENTORY_PLUGIN_MANIFEST,
  GUEST_ORDER_ACCESS_PLUGIN_MANIFEST,
  SUPPORT_AUDIT_PLUGIN_MANIFEST,
  MARKETING_ENGINE_PLUGIN_MANIFEST,
  NOTIFICATION_RESEND_PLUGIN_MANIFEST,
  ANALYTICS_CORE_PLUGIN_MANIFEST,
  ANALYTICS_GA4_PLUGIN_MANIFEST,
  ANALYTICS_HOTJAR_PLUGIN_MANIFEST,
]

export const PLATFORM_FALLBACK_PLUGIN_MANIFESTS: PluginManifest[] = [
  PLATFORM_INVENTORY_NOOP_PLUGIN_MANIFEST,
  PLATFORM_DELIVERY_NOOP_PLUGIN_MANIFEST,
  PLATFORM_PRODUCT_POLICY_DEFAULT_PLUGIN_MANIFEST,
  PLATFORM_MARKETING_NOOP_PLUGIN_MANIFEST,
  PLATFORM_PAYMENT_NOOP_PLUGIN_MANIFEST,
  PLATFORM_ORDER_ACCESS_NOOP_PLUGIN_MANIFEST,
]

export const PLATFORM_BUILTIN_PLUGIN_MANIFESTS: PluginManifest[] = [
  ...PLATFORM_CORE_PLUGIN_MANIFESTS,
  ...PLATFORM_FALLBACK_PLUGIN_MANIFESTS,
]

export function discoverBuiltinPluginManifests() {
  return PLATFORM_BUILTIN_PLUGIN_MANIFESTS.map((manifest) => ({
    ...manifest,
    capabilities: [...manifest.capabilities],
    dependencies: manifest.dependencies?.map((dependency) => ({
      ...dependency,
    })),
  }))
}
