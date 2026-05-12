import type { PluginManifest } from "../../platform/contracts"

export const NOTIFICATION_RESEND_PLUGIN_MANIFEST: PluginManifest = {
  id: "notification-resend",
  version: "1.0.0",
  capabilities: ["hook-subscriber"],
  enabledByDefault: true,
  migrationsOwner: "platform",
  title: "Resend Notifications",
  description: "Deliver transactional notification emails through Resend.",
}
