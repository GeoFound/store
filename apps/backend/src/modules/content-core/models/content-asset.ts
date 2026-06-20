import { model } from "@medusajs/framework/utils"

const ContentAsset = model.define("content_asset", {
  id: model.id().primaryKey(),
  site_id: model.text().default("global"),
  entry_id: model.text().nullable(),
  revision_id: model.text().nullable(),
  asset_type: model
    .enum(["cover_image", "inline_image", "audio", "attachment", "transcript", "source"])
    .default("attachment"),
  storage_provider: model
    .enum(["local", "s3", "r2", "external"])
    .default("external"),
  storage_provider_code: model.text().nullable(),
  bucket: model.text().nullable(),
  object_key: model.text().nullable(),
  public_url: model.text().nullable(),
  mime_type: model.text().nullable(),
  byte_size: model.number().nullable(),
  checksum: model.text().nullable(),
  width: model.number().nullable(),
  height: model.number().nullable(),
  duration_seconds: model.number().nullable(),
  alt_text: model.text().nullable(),
  caption: model.text().nullable(),
  metadata_json: model.json().nullable(),
})

export default ContentAsset
