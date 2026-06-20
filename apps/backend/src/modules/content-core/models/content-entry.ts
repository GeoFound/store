import { model } from "@medusajs/framework/utils"

const ContentEntry = model.define("content_entry", {
  id: model.id().primaryKey(),
  site_id: model.text().default("global"),
  slug: model.text(),
  title: model.text(),
  excerpt: model.text().nullable(),
  body: model.text().nullable(),
  content_format: model
    .enum(["plain_text", "markdown", "html", "portable_json"])
    .default("plain_text"),
  content_type: model
    .enum(["article", "guide", "report", "review", "resource", "case_study"])
    .default("article"),
  status: model.enum(["draft", "review", "published", "archived"]).default("draft"),
  author_name: model.text().nullable(),
  canonical_revision_id: model.text().nullable(),
  cover_asset_id: model.text().nullable(),
  cover_image_url: model.text().nullable(),
  audio_asset_id: model.text().nullable(),
  language: model.text().nullable(),
  reading_time_minutes: model.number().nullable(),
  word_count: model.number().nullable(),
  topic: model.text().nullable(),
  tags_json: model.json().nullable(),
  seo_json: model.json().nullable(),
  source_refs_json: model.json().nullable(),
  related_product_handles_json: model.json().nullable(),
  ai_assisted: model.boolean().default(false),
  published_at: model.dateTime().nullable(),
  metadata_json: model.json().nullable(),
})

export default ContentEntry
