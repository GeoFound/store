import type { PluginManifest } from "../../platform/contracts"

export const ANALYTICS_CORE_PLUGIN_MANIFEST: PluginManifest = {
  id: "analytics-core",
  version: "1.0.0",
  capabilities: [],
  enabledByDefault: true,
  migrationsOwner: "analytics-core",
  title: "Analytics Core",
  description:
    "Canonical analytics event and dispatch pipeline with retry and plugin-managed destinations.",
}
