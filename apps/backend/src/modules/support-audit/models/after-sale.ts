import { model } from "@medusajs/framework/utils"

const AfterSale = model.define("after_sale", {
  id: model.id().primaryKey(),
  delivery_id: model.text(),
  order_id: model.text().nullable(),
  cart_id: model.text().nullable(),
  payment_attempt_id: model.text().nullable(),
  account_item_id: model.text().nullable(),
  customer_email: model.text().nullable(),
  reason: model
    .enum(["not_working", "wrong_item", "duplicate", "refund", "other"])
    .default("other"),
  message: model.text(),
  status: model
    .enum(["open", "processing", "resolved", "rejected", "closed"])
    .default("open"),
  admin_note: model.text().nullable(),
  result: model
    .enum(["pending", "replaced", "refunded", "rejected", "resolved"])
    .default("pending"),
  handled_by: model.text().nullable(),
  handled_at: model.dateTime().nullable(),
  metadata_json: model.json().nullable(),
})

export default AfterSale
