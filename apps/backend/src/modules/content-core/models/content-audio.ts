import { model } from "@medusajs/framework/utils"

const ContentAudio = model.define("content_audio", {
  id: model.id().primaryKey(),
  site_id: model.text().default("global"),
  entry_id: model.text(),
  revision_id: model.text().nullable(),
  asset_id: model.text().nullable(),
  status: model
    .enum(["queued", "processing", "ready", "failed", "archived"])
    .default("queued"),
  provider_code: model.text().nullable(),
  model: model.text().nullable(),
  voice: model.text().nullable(),
  language: model.text().nullable(),
  transcript: model.text().nullable(),
  duration_seconds: model.number().nullable(),
  error_message: model.text().nullable(),
  metadata_json: model.json().nullable(),
})

export default ContentAudio
