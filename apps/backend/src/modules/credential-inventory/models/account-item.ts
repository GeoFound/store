import { model } from "@medusajs/framework/utils"

const AccountItem = model.define("account_item", {
  id: model.id().primaryKey(),
  batch_id: model.text(),
  product_variant_id: model.text(),
  status: model
    .enum(["in_stock", "reserved", "sold", "locked", "refunded"])
    .default("in_stock"),
  account_identifier: model.text(),
  display_label: model.text(),
  credential_blob: model.text(),
  credential_version: model.number().default(1),
  source_note: model.text().nullable(),
  cost_price: model.number().nullable(),
  currency: model.text().nullable(),
  reservation_key: model.text().nullable(),
  cart_id: model.text().nullable(),
  order_id: model.text().nullable(),
  reserved_at: model.dateTime().nullable(),
  reserved_until: model.dateTime().nullable(),
  sold_at: model.dateTime().nullable(),
  delivered_at: model.dateTime().nullable(),
  metadata_json: model.json().nullable(),
})

export default AccountItem
