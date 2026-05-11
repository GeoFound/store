import { model } from "@medusajs/framework/utils"

const AnalyticsEvent = model.define("analytics_event", {
  id: model.id().primaryKey(),
  event_name: model.text(),
  source: model.enum(["backend_hook", "storefront", "system"]).default("backend_hook"),
  event_key: model.text().nullable(),
  status: model
    .enum(["pending", "processing", "delivered", "failed", "partial"])
    .default("pending"),
  occurred_at: model.dateTime(),
  cart_id: model.text().nullable(),
  order_id: model.text().nullable(),
  payment_attempt_id: model.text().nullable(),
  customer_email_hash: model.text().nullable(),
  payload_json: model.json().nullable(),
  metadata_json: model.json().nullable(),
})

export default AnalyticsEvent
