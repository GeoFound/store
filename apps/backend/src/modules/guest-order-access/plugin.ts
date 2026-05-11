import type { PluginManifest } from "../../platform/contracts"

export const GUEST_ORDER_ACCESS_PLUGIN_MANIFEST: PluginManifest = {
  id: "guest-order-access",
  version: "1.0.0",
  capabilities: ["order-access-provider", "hook-subscriber"],
  enabledByDefault: true,
  migrationsOwner: "guest-order-access",
  title: "Guest Order Access",
  description: "Guest-safe order access and recovery token handling.",
}
