import type { PluginManifest } from "../../platform/contracts"

export const SUPPLIER_RELOADLY_PLUGIN_MANIFEST: PluginManifest = {
  id: "supplier-reloadly",
  version: "1.0.0",
  capabilities: ["supplier-provider", "background-job", "admin-extension"],
  dependencies: [
    {
      id: "supplier-procurement",
      version: "1.x",
    },
  ],
  enabledByDefault: true,
  migrationsOwner: "supplier-procurement",
  title: "Reloadly Supplier",
  description:
    "Reloadly-backed gift card, airtime, and data bundle procurement provider.",
}
