import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260608054644 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "content_entry" ("id" text not null, "site_id" text not null default 'global', "slug" text not null, "title" text not null, "excerpt" text null, "body" text null, "content_type" text check ("content_type" in ('article', 'guide', 'report', 'review', 'resource', 'case_study')) not null default 'article', "status" text check ("status" in ('draft', 'review', 'published', 'archived')) not null default 'draft', "author_name" text null, "cover_image_url" text null, "topic" text null, "tags_json" jsonb null, "seo_json" jsonb null, "source_refs_json" jsonb null, "related_product_handles_json" jsonb null, "ai_assisted" boolean not null default false, "published_at" timestamptz null, "metadata_json" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "content_entry_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_content_entry_deleted_at" ON "content_entry" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`create unique index if not exists "IDX_content_entry_site_slug_unique" on "content_entry" ("site_id", "slug") where "deleted_at" is null;`);
    this.addSql(`create index if not exists "IDX_content_entry_site_status_published" on "content_entry" ("site_id", "status", "published_at") where "deleted_at" is null;`);
    this.addSql(`create index if not exists "IDX_content_entry_type_status" on "content_entry" ("content_type", "status") where "deleted_at" is null;`);
    this.addSql(`create index if not exists "IDX_content_entry_topic" on "content_entry" ("topic") where "deleted_at" is null and "topic" is not null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_content_entry_topic";`);
    this.addSql(`drop index if exists "IDX_content_entry_type_status";`);
    this.addSql(`drop index if exists "IDX_content_entry_site_status_published";`);
    this.addSql(`drop index if exists "IDX_content_entry_site_slug_unique";`);
    this.addSql(`drop index if exists "IDX_content_entry_deleted_at";`);
    this.addSql(`drop table if exists "content_entry" cascade;`);
  }

}
