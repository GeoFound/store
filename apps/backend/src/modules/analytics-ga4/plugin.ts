import type { PluginManifest } from "../../platform/contracts"

export const ANALYTICS_GA4_PLUGIN_MANIFEST: PluginManifest = {
  id: "analytics-ga4",
  version: "1.0.0",
  capabilities: ["hook-subscriber", "background-job", "storefront-slot"],
  enabledByDefault: true,
  migrationsOwner: "analytics-core",
  title: "GA4 Analytics",
  description:
    "Google Analytics 4 destination with storefront script injection and backend event dispatch.",
}
