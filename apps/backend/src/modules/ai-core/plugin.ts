import type { PluginManifest } from "../../platform/contracts"

export const AI_CORE_PLUGIN_MANIFEST: PluginManifest = {
  id: "ai-core",
  version: "1.0.0",
  capabilities: ["admin-extension"],
  enabledByDefault: true,
  migrationsOwner: "ai-core",
  title: "AI Core",
  description:
    "Provider-agnostic AI configuration, task plugin registry, and backend operations visibility.",
}
