import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260611104500 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "content_entry" add column if not exists "content_format" text check ("content_format" in ('plain_text', 'markdown', 'html', 'portable_json')) not null default 'plain_text';`);
    this.addSql(`alter table if exists "content_entry" add column if not exists "canonical_revision_id" text null;`);
    this.addSql(`alter table if exists "content_entry" add column if not exists "cover_asset_id" text null;`);
    this.addSql(`alter table if exists "content_entry" add column if not exists "audio_asset_id" text null;`);
    this.addSql(`alter table if exists "content_entry" add column if not exists "language" text null;`);
    this.addSql(`alter table if exists "content_entry" add column if not exists "reading_time_minutes" integer null;`);
    this.addSql(`alter table if exists "content_entry" add column if not exists "word_count" integer null;`);

    this.addSql(`create table if not exists "content_revision" ("id" text not null, "entry_id" text not null, "site_id" text not null default 'global', "revision_number" integer not null default 1, "title" text not null, "excerpt" text null, "body" text null, "content_format" text check ("content_format" in ('plain_text', 'markdown', 'html', 'portable_json')) not null default 'plain_text', "status" text check ("status" in ('draft', 'review', 'published', 'superseded', 'archived')) not null default 'draft', "author_name" text null, "editor_name" text null, "language" text null, "word_count" integer null, "reading_time_minutes" integer null, "seo_json" jsonb null, "source_refs_json" jsonb null, "readability_json" jsonb null, "ai_task_run_id" text null, "checksum" text null, "change_note" text null, "metadata_json" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "content_revision_pkey" primary key ("id"));`);
    this.addSql(`create unique index if not exists "IDX_content_revision_entry_number_unique" on "content_revision" ("entry_id", "revision_number") where "deleted_at" is null;`);
    this.addSql(`create index if not exists "IDX_content_revision_entry_status" on "content_revision" ("entry_id", "status") where "deleted_at" is null;`);
    this.addSql(`create index if not exists "IDX_content_revision_site_status" on "content_revision" ("site_id", "status") where "deleted_at" is null;`);

    this.addSql(`create table if not exists "content_asset" ("id" text not null, "site_id" text not null default 'global', "entry_id" text null, "revision_id" text null, "asset_type" text check ("asset_type" in ('cover_image', 'inline_image', 'audio', 'attachment', 'transcript', 'source')) not null default 'attachment', "storage_provider" text check ("storage_provider" in ('local', 's3', 'r2', 'external')) not null default 'external', "storage_provider_code" text null, "bucket" text null, "object_key" text null, "public_url" text null, "mime_type" text null, "byte_size" integer null, "checksum" text null, "width" integer null, "height" integer null, "duration_seconds" integer null, "alt_text" text null, "caption" text null, "metadata_json" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "content_asset_pkey" primary key ("id"));`);
    this.addSql(`create index if not exists "IDX_content_asset_entry_type" on "content_asset" ("entry_id", "asset_type") where "deleted_at" is null;`);
    this.addSql(`create index if not exists "IDX_content_asset_site_type" on "content_asset" ("site_id", "asset_type") where "deleted_at" is null;`);
    this.addSql(`create index if not exists "IDX_content_asset_storage_key" on "content_asset" ("storage_provider_code", "object_key") where "deleted_at" is null and "object_key" is not null;`);

    this.addSql(`create table if not exists "content_audio" ("id" text not null, "site_id" text not null default 'global', "entry_id" text not null, "revision_id" text null, "asset_id" text null, "status" text check ("status" in ('queued', 'processing', 'ready', 'failed', 'archived')) not null default 'queued', "provider_code" text null, "model" text null, "voice" text null, "language" text null, "transcript" text null, "duration_seconds" integer null, "error_message" text null, "metadata_json" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "content_audio_pkey" primary key ("id"));`);
    this.addSql(`create index if not exists "IDX_content_audio_entry_status" on "content_audio" ("entry_id", "status") where "deleted_at" is null;`);
    this.addSql(`create index if not exists "IDX_content_audio_site_status" on "content_audio" ("site_id", "status") where "deleted_at" is null;`);

    this.addSql(`create table if not exists "content_publication" ("id" text not null, "site_id" text not null default 'global', "entry_id" text not null, "revision_id" text null, "channel" text check ("channel" in ('storefront', 'rss', 'sitemap', 'api', 'social')) not null default 'storefront', "status" text check ("status" in ('scheduled', 'published', 'unpublished', 'failed')) not null default 'published', "publish_at" timestamptz null, "published_at" timestamptz null, "unpublished_at" timestamptz null, "error_message" text null, "metadata_json" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "content_publication_pkey" primary key ("id"));`);
    this.addSql(`create index if not exists "IDX_content_publication_entry_channel" on "content_publication" ("entry_id", "channel", "status") where "deleted_at" is null;`);
    this.addSql(`create index if not exists "IDX_content_publication_site_status" on "content_publication" ("site_id", "status", "publish_at") where "deleted_at" is null;`);

    this.addSql(`create table if not exists "content_ai_task_run" ("id" text not null, "site_id" text not null default 'global', "entry_id" text null, "revision_id" text null, "task_type" text check ("task_type" in ('article_outline', 'article_draft', 'article_rewrite', 'seo', 'summary', 'readability', 'fact_check', 'translation', 'tts', 'stt', 'custom')) not null default 'custom', "provider_code" text null, "provider_protocol" text null, "provider_capability" text null, "model" text null, "status" text check ("status" in ('queued', 'running', 'succeeded', 'failed', 'canceled', 'requires_review')) not null default 'queued', "review_status" text check ("review_status" in ('pending', 'approved', 'rejected', 'needs_changes', 'not_required')) not null default 'pending', "input_summary" text null, "output_summary" text null, "input_json" jsonb null, "output_json" jsonb null, "source_refs_json" jsonb null, "artifact_refs_json" jsonb null, "error_message" text null, "started_at" timestamptz null, "completed_at" timestamptz null, "metadata_json" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "content_ai_task_run_pkey" primary key ("id"));`);
    this.addSql(`create index if not exists "IDX_content_ai_task_run_entry_status" on "content_ai_task_run" ("entry_id", "task_type", "status") where "deleted_at" is null;`);
    this.addSql(`create index if not exists "IDX_content_ai_task_run_site_status" on "content_ai_task_run" ("site_id", "status", "created_at") where "deleted_at" is null;`);
    this.addSql(`create index if not exists "IDX_content_ai_task_run_review" on "content_ai_task_run" ("review_status", "created_at") where "deleted_at" is null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_content_ai_task_run_review";`);
    this.addSql(`drop index if exists "IDX_content_ai_task_run_site_status";`);
    this.addSql(`drop index if exists "IDX_content_ai_task_run_entry_status";`);
    this.addSql(`drop table if exists "content_ai_task_run" cascade;`);
    this.addSql(`drop index if exists "IDX_content_publication_site_status";`);
    this.addSql(`drop index if exists "IDX_content_publication_entry_channel";`);
    this.addSql(`drop table if exists "content_publication" cascade;`);
    this.addSql(`drop index if exists "IDX_content_audio_site_status";`);
    this.addSql(`drop index if exists "IDX_content_audio_entry_status";`);
    this.addSql(`drop table if exists "content_audio" cascade;`);
    this.addSql(`drop index if exists "IDX_content_asset_storage_key";`);
    this.addSql(`drop index if exists "IDX_content_asset_site_type";`);
    this.addSql(`drop index if exists "IDX_content_asset_entry_type";`);
    this.addSql(`drop table if exists "content_asset" cascade;`);
    this.addSql(`drop index if exists "IDX_content_revision_site_status";`);
    this.addSql(`drop index if exists "IDX_content_revision_entry_status";`);
    this.addSql(`drop index if exists "IDX_content_revision_entry_number_unique";`);
    this.addSql(`drop table if exists "content_revision" cascade;`);
    this.addSql(`alter table if exists "content_entry" drop column if exists "word_count";`);
    this.addSql(`alter table if exists "content_entry" drop column if exists "reading_time_minutes";`);
    this.addSql(`alter table if exists "content_entry" drop column if exists "language";`);
    this.addSql(`alter table if exists "content_entry" drop column if exists "audio_asset_id";`);
    this.addSql(`alter table if exists "content_entry" drop column if exists "cover_asset_id";`);
    this.addSql(`alter table if exists "content_entry" drop column if exists "canonical_revision_id";`);
    this.addSql(`alter table if exists "content_entry" drop column if exists "content_format";`);
  }

}
