import { model } from "@medusajs/framework/utils"

const ContentRevision = model.define("content_revision", {
  id: model.id().primaryKey(),
  entry_id: model.text(),
  site_id: model.text().default("global"),
  revision_number: model.number().default(1),
  title: model.text(),
  excerpt: model.text().nullable(),
  body: model.text().nullable(),
  content_format: model
    .enum(["plain_text", "markdown", "html", "portable_json"])
    .default("plain_text"),
  status: model
    .enum(["draft", "review", "published", "superseded", "archived"])
    .default("draft"),
  author_name: model.text().nullable(),
  editor_name: model.text().nullable(),
  language: model.text().nullable(),
  word_count: model.number().nullable(),
  reading_time_minutes: model.number().nullable(),
  seo_json: model.json().nullable(),
  source_refs_json: model.json().nullable(),
  readability_json: model.json().nullable(),
  ai_task_run_id: model.text().nullable(),
  checksum: model.text().nullable(),
  change_note: model.text().nullable(),
  metadata_json: model.json().nullable(),
})

export default ContentRevision
