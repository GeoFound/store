import type { PluginManifest } from "../../platform/contracts"

export const SUPPORT_AUDIT_PLUGIN_MANIFEST: PluginManifest = {
  id: "support-audit",
  version: "1.0.0",
  capabilities: ["hook-subscriber"],
  enabledByDefault: true,
  migrationsOwner: "support-audit",
  title: "Support Audit",
  description: "Audit logging for sensitive and support actions.",
}
