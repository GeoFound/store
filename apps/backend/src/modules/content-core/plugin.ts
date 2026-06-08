import type { PluginManifest } from "../../platform/contracts"

export const CONTENT_CORE_PLUGIN_MANIFEST: PluginManifest = {
  id: "content-core",
  version: "1.0.0",
  capabilities: ["admin-extension", "content-publishing"],
  enabledByDefault: true,
  migrationsOwner: "content-core",
  title: "Content Core",
  description:
    "Site-scoped editorial entries, publishing status, source references, and AI-assisted draft metadata.",
}
