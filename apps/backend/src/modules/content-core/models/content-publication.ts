import { model } from "@medusajs/framework/utils"

const ContentPublication = model.define("content_publication", {
  id: model.id().primaryKey(),
  site_id: model.text().default("global"),
  entry_id: model.text(),
  revision_id: model.text().nullable(),
  channel: model
    .enum(["storefront", "rss", "sitemap", "api", "social"])
    .default("storefront"),
  status: model
    .enum(["scheduled", "published", "unpublished", "failed"])
    .default("published"),
  publish_at: model.dateTime().nullable(),
  published_at: model.dateTime().nullable(),
  unpublished_at: model.dateTime().nullable(),
  error_message: model.text().nullable(),
  metadata_json: model.json().nullable(),
})

export default ContentPublication
