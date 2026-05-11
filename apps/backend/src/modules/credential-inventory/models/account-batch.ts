import { model } from "@medusajs/framework/utils"

const AccountBatch = model.define("account_batch", {
  id: model.id().primaryKey(),
  name: model.text(),
  product_variant_id: model.text(),
  status: model
    .enum(["active", "closed", "depleted", "archived"])
    .default("active"),
  source_note: model.text().nullable(),
  total_count: model.number().default(0),
  available_count: model.number().default(0),
  reserved_count: model.number().default(0),
  sold_count: model.number().default(0),
  locked_count: model.number().default(0),
  cost_price: model.number().nullable(),
  currency: model.text().nullable(),
  metadata_json: model.json().nullable(),
})

export default AccountBatch
