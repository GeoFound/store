import type { PluginManifest } from "../../platform/contracts"

export const DIGITAL_DELIVERY_PLUGIN_MANIFEST: PluginManifest = {
  id: "digital-delivery",
  version: "1.0.0",
  capabilities: ["delivery-handler"],
  enabledByDefault: true,
  migrationsOwner: "digital-delivery",
  title: "Digital Delivery",
  description: "Delivery records and guest-facing delivery payload access.",
}
