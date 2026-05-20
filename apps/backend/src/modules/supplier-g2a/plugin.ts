import type { PluginManifest } from "../../platform/contracts"

export const SUPPLIER_G2A_PLUGIN_MANIFEST: PluginManifest = {
  id: "supplier-g2a",
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
  title: "G2A Supplier",
  description:
    "G2A Export API procurement provider for game, software, and gift-card keys.",
}
