import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260621120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "content_seo_document" ("id" text not null, "entity_type" text check ("entity_type" in ('product', 'content_entry', 'collection', 'page', 'site')) not null default 'page', "entity_id" text not null, "site_id" text not null default 'global', "language" text not null default '*', "meta_title" text null, "meta_description" text null, "canonical_url" text null, "slug" text null, "robots_json" jsonb null, "og_title" text null, "og_description" text null, "og_image_url" text null, "keywords_json" jsonb null, "schema_type" text null, "schema_json" jsonb null, "summary_tldr" text null, "faq_json" jsonb null, "key_facts_json" jsonb null, "entities_json" jsonb null, "answer_target" text null, "status" text check ("status" in ('draft', 'review', 'published', 'archived')) not null default 'draft', "review_status" text check ("review_status" in ('pending', 'approved', 'rejected', 'needs_changes', 'not_required')) not null default 'not_required', "source" text check ("source" in ('human', 'ai', 'mixed')) not null default 'human', "version" integer not null default 1, "schema_version" integer not null default 1, "ai_task_run_id" text null, "metadata_json" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "content_seo_document_pkey" primary key ("id"));`);
    this.addSql(`create unique index if not exists "IDX_content_seo_document_entity_unique" on "content_seo_document" ("entity_type", "entity_id", "site_id", "language") where "deleted_at" is null;`);
    this.addSql(`create index if not exists "IDX_content_seo_document_entity_lookup" on "content_seo_document" ("entity_type", "entity_id", "site_id") where "deleted_at" is null;`);
    this.addSql(`create index if not exists "IDX_content_seo_document_site_status" on "content_seo_document" ("site_id", "status") where "deleted_at" is null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_content_seo_document_site_status";`);
    this.addSql(`drop index if exists "IDX_content_seo_document_entity_lookup";`);
    this.addSql(`drop index if exists "IDX_content_seo_document_entity_unique";`);
    this.addSql(`drop table if exists "content_seo_document" cascade;`);
  }

}
