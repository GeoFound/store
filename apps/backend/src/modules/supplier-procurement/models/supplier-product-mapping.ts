import { model } from "@medusajs/framework/utils"

const SupplierProductMapping = model.define("supplier_product_mapping", {
  id: model.id().primaryKey(),
  product_variant_id: model.text(),
  provider_code: model.text(),
  provider_sku: model.text(),
  provider_product_id: model.text().nullable(),
  provider_variant_id: model.text().nullable(),
  region_code: model.text().nullable(),
  currency: model.text().nullable(),
  enabled: model.boolean().default(true),
  priority: model.number().default(100),
  cost_price: model.number().nullable(),
  list_price: model.number().nullable(),
  metadata_json: model.json().nullable(),
})

export default SupplierProductMapping
