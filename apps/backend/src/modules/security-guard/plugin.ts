import type { PluginManifest } from "../../platform/contracts"

export const SECURITY_GUARD_PLUGIN_MANIFEST: PluginManifest = {
  id: "security-guard",
  version: "1.0.0",
  capabilities: [],
  enabledByDefault: true,
  migrationsOwner: "security-guard",
  title: "Security Guard",
  description:
    "API boundary protections: request origin checks, abusive traffic throttling, and hardened response headers.",
}
