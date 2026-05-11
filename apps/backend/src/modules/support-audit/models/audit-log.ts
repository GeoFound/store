import { model } from "@medusajs/framework/utils"

const AuditLog = model.define("audit_log", {
  id: model.id().primaryKey(),
  actor_type: model
    .enum(["admin", "customer", "guest", "system", "webhook"])
    .default("system"),
  actor_id: model.text().nullable(),
  action: model.text(),
  entity_type: model.text(),
  entity_id: model.text().nullable(),
  risk_level: model.enum(["low", "medium", "high"]).default("low"),
  ip_address: model.text().nullable(),
  user_agent: model.text().nullable(),
  metadata_json: model.json().nullable(),
})

export default AuditLog
