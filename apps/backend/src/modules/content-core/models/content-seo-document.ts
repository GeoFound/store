import { model } from "@medusajs/framework/utils"

/**
 * Canonical, consumer-agnostic discoverability document for any indexable
 * entity (product, content entry, collection, page, site). Serialized by the
 * storefront into meta tags, JSON-LD, sitemap, and llms.txt. Keyed by
 * entity_type x entity_id x site_id x language; language defaults to "*"
 * (applies to all languages) so the uniqueness key never depends on NULL.
 * See docs/seo-aeo-geo-architecture.md.
 */
const ContentSeoDocument = model.define("content_seo_document", {
  id: model.id().primaryKey(),
  entity_type: model
    .enum(["product", "content_entry", "collection", "page", "site"])
    .default("page"),
  entity_id: model.text(),
  site_id: model.text().default("global"),
  language: model.text().default("*"),
  // SEO base
  meta_title: model.text().nullable(),
  meta_description: model.text().nullable(),
  canonical_url: model.text().nullable(),
  slug: model.text().nullable(),
  robots_json: model.json().nullable(),
  og_title: model.text().nullable(),
  og_description: model.text().nullable(),
  og_image_url: model.text().nullable(),
  keywords_json: model.json().nullable(),
  // Structured data (SEO + AEO + GEO)
  schema_type: model.text().nullable(),
  schema_json: model.json().nullable(),
  // AEO / GEO "quotability"
  summary_tldr: model.text().nullable(),
  faq_json: model.json().nullable(),
  key_facts_json: model.json().nullable(),
  entities_json: model.json().nullable(),
  answer_target: model.text().nullable(),
  // Governance
  status: model
    .enum(["draft", "review", "published", "archived"])
    .default("draft"),
  review_status: model
    .enum(["pending", "approved", "rejected", "needs_changes", "not_required"])
    .default("not_required"),
  source: model.enum(["human", "ai", "mixed"]).default("human"),
  version: model.number().default(1),
  schema_version: model.number().default(1),
  ai_task_run_id: model.text().nullable(),
  metadata_json: model.json().nullable(),
})

export default ContentSeoDocument
