import type { PluginManifest } from "../../platform/contracts"

export const SUPPLIER_PROCUREMENT_PLUGIN_MANIFEST: PluginManifest = {
  id: "supplier-procurement",
  version: "1.0.0",
  capabilities: [
    "supplier-provider",
    "delivery-handler",
    "product-policy",
    "background-job",
    "admin-extension",
  ],
  enabledByDefault: true,
  migrationsOwner: "supplier-procurement",
  title: "Supplier Procurement",
  description:
    "External supplier SKU mapping, procurement order state, and supplier-backed delivery orchestration.",
}
