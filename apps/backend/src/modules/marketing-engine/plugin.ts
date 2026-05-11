import type { PluginManifest } from "../../platform/contracts"

export const MARKETING_ENGINE_PLUGIN_MANIFEST: PluginManifest = {
  id: "marketing-engine",
  version: "1.0.0",
  capabilities: [
    "marketing-strategy",
    "hook-subscriber",
    "background-job",
    "storefront-slot",
    "admin-extension",
  ],
  enabledByDefault: true,
  migrationsOwner: "marketing-engine",
  title: "Marketing Engine",
  description:
    "Campaign, coupon, referral, attribution, and automation engine with pluggable marketing strategies.",
}
