import { model } from "@medusajs/framework/utils"

const AnalyticsDispatch = model.define("analytics_dispatch", {
  id: model.id().primaryKey(),
  event_id: model.text(),
  destination_code: model.text(),
  status: model
    .enum(["pending", "processing", "delivered", "failed", "dead"])
    .default("pending"),
  attempt_count: model.number().default(0),
  last_attempt_at: model.dateTime().nullable(),
  next_retry_at: model.dateTime().nullable(),
  delivered_at: model.dateTime().nullable(),
  response_status: model.number().nullable(),
  error_message: model.text().nullable(),
  response_body: model.text().nullable(),
  metadata_json: model.json().nullable(),
})

export default AnalyticsDispatch
