import type { PluginManifest } from "../../platform/contracts"

export const CONTENT_CORE_PLUGIN_MANIFEST: PluginManifest = {
  id: "content-core",
  version: "1.0.0",
  capabilities: [
    "admin-extension",
    "ai-task-plugin",
    "content-publishing",
  ],
  enabledByDefault: true,
  migrationsOwner: "content-core",
  title: "Content Core",
  description:
    "Site-scoped editorial entries, revisions, storage-backed assets, audio records, and provider-neutral AI task metadata.",
}
