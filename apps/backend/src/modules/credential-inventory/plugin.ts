import type { PluginManifest } from "../../platform/contracts"

export const CREDENTIAL_INVENTORY_PLUGIN_MANIFEST: PluginManifest = {
  id: "credential-inventory",
  version: "1.0.0",
  capabilities: [
    "inventory-handler",
    "delivery-handler",
    "product-policy",
    "background-job",
  ],
  enabledByDefault: true,
  migrationsOwner: "credential-inventory",
  title: "Credential Inventory",
  description: "Encrypted inventory storage and reservation management.",
}
