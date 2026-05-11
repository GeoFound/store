import type { PluginManifest } from "../../platform/contracts"

export const PAYMENT_ROUTER_PLUGIN_MANIFEST: PluginManifest = {
  id: "payment-router",
  version: "1.0.0",
  capabilities: ["payment-provider"],
  enabledByDefault: true,
  migrationsOwner: "payment-router",
  title: "Payment Router",
  description: "Payment provider routing and attempt management.",
}
