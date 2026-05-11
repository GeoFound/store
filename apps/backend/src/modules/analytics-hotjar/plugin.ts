import type { PluginManifest } from "../../platform/contracts"

export const ANALYTICS_HOTJAR_PLUGIN_MANIFEST: PluginManifest = {
  id: "analytics-hotjar",
  version: "1.0.0",
  capabilities: ["storefront-slot"],
  enabledByDefault: true,
  migrationsOwner: "analytics-core",
  title: "Hotjar Analytics",
  description:
    "Hotjar session analytics and feedback instrumentation through storefront slot injection.",
}
