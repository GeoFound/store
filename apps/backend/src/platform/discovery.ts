import { PAYMENT_ROUTER_PLUGIN_MANIFEST } from "../modules/payment-router/plugin"
import { DIGITAL_DELIVERY_PLUGIN_MANIFEST } from "../modules/digital-delivery/plugin"
import { CREDENTIAL_INVENTORY_PLUGIN_MANIFEST } from "../modules/credential-inventory/plugin"
import { GUEST_ORDER_ACCESS_PLUGIN_MANIFEST } from "../modules/guest-order-access/plugin"
import { SUPPORT_AUDIT_PLUGIN_MANIFEST } from "../modules/support-audit/plugin"
import { MARKETING_ENGINE_PLUGIN_MANIFEST } from "../modules/marketing-engine/plugin"
import { ANALYTICS_CORE_PLUGIN_MANIFEST } from "../modules/analytics-core/plugin"
import { ANALYTICS_GA4_PLUGIN_MANIFEST } from "../modules/analytics-ga4/plugin"
import { ANALYTICS_HOTJAR_PLUGIN_MANIFEST } from "../modules/analytics-hotjar/plugin"
import type { PluginManifest } from "./contracts"

export const PLATFORM_FALLBACK_PLUGIN_MANIFEST: PluginManifest = {
  id: "platform.fallback",
  version: "1.0.0",
  capabilities: ["payment-provider", "inventory-handler", "delivery-handler", "order-access-provider", "marketing-strategy"],
  enabledByDefault: true,
  migrationsOwner: "platform",
  title: "Platform Fallbacks",
  description: "Built-in fallback capability manifest.",
}

export function discoverBuiltinPluginManifests() {
  return [
    PAYMENT_ROUTER_PLUGIN_MANIFEST,
    DIGITAL_DELIVERY_PLUGIN_MANIFEST,
    CREDENTIAL_INVENTORY_PLUGIN_MANIFEST,
    GUEST_ORDER_ACCESS_PLUGIN_MANIFEST,
    SUPPORT_AUDIT_PLUGIN_MANIFEST,
    MARKETING_ENGINE_PLUGIN_MANIFEST,
    ANALYTICS_CORE_PLUGIN_MANIFEST,
    ANALYTICS_GA4_PLUGIN_MANIFEST,
    ANALYTICS_HOTJAR_PLUGIN_MANIFEST,
    PLATFORM_FALLBACK_PLUGIN_MANIFEST,
  ]
}
