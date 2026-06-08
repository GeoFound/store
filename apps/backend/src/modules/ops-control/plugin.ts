import type { PluginManifest } from "../../platform/contracts"

export const OPS_CONTROL_PLUGIN_MANIFEST: PluginManifest = {
  id: "ops-control",
  version: "1.0.0",
  capabilities: ["admin-extension", "ai-task-plugin"],
  enabledByDefault: true,
  migrationsOwner: "ops-control",
  title: "Operations Control",
  description:
    "Production operations readiness, security posture, deployment, backup, and AI-assisted maintenance visibility.",
}
