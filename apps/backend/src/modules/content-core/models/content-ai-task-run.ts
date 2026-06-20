import { model } from "@medusajs/framework/utils"

const ContentAITaskRun = model.define("content_ai_task_run", {
  id: model.id().primaryKey(),
  site_id: model.text().default("global"),
  entry_id: model.text().nullable(),
  revision_id: model.text().nullable(),
  task_type: model
    .enum([
      "article_outline",
      "article_draft",
      "article_rewrite",
      "seo",
      "summary",
      "readability",
      "fact_check",
      "translation",
      "tts",
      "stt",
      "custom",
    ])
    .default("custom"),
  provider_code: model.text().nullable(),
  provider_protocol: model.text().nullable(),
  provider_capability: model.text().nullable(),
  model: model.text().nullable(),
  status: model
    .enum(["queued", "running", "succeeded", "failed", "canceled", "requires_review"])
    .default("queued"),
  review_status: model
    .enum(["pending", "approved", "rejected", "needs_changes", "not_required"])
    .default("pending"),
  input_summary: model.text().nullable(),
  output_summary: model.text().nullable(),
  input_json: model.json().nullable(),
  output_json: model.json().nullable(),
  source_refs_json: model.json().nullable(),
  artifact_refs_json: model.json().nullable(),
  error_message: model.text().nullable(),
  started_at: model.dateTime().nullable(),
  completed_at: model.dateTime().nullable(),
  metadata_json: model.json().nullable(),
})

export default ContentAITaskRun
