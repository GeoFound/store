import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260511221000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "analytics_event" ("id" text not null, "event_name" text not null, "source" text check ("source" in ('backend_hook', 'storefront', 'system')) not null default 'backend_hook', "event_key" text null, "status" text check ("status" in ('pending', 'processing', 'delivered', 'failed', 'partial')) not null default 'pending', "occurred_at" timestamptz not null, "cart_id" text null, "order_id" text null, "payment_attempt_id" text null, "customer_email_hash" text null, "payload_json" jsonb null, "metadata_json" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "analytics_event_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_analytics_event_deleted_at" ON "analytics_event" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `create unique index if not exists "IDX_analytics_event_event_key_unique" on "analytics_event" ("event_key") where "deleted_at" is null and "event_key" is not null;`
    )
    this.addSql(
      `create index if not exists "IDX_analytics_event_name_occurred" on "analytics_event" ("event_name", "occurred_at") where "deleted_at" is null;`
    )
    this.addSql(
      `create index if not exists "IDX_analytics_event_order_id" on "analytics_event" ("order_id") where "deleted_at" is null and "order_id" is not null;`
    )
    this.addSql(
      `create index if not exists "IDX_analytics_event_attempt_id" on "analytics_event" ("payment_attempt_id") where "deleted_at" is null and "payment_attempt_id" is not null;`
    )

    this.addSql(
      `create table if not exists "analytics_dispatch" ("id" text not null, "event_id" text not null, "destination_code" text not null, "status" text check ("status" in ('pending', 'processing', 'delivered', 'failed', 'dead')) not null default 'pending', "attempt_count" integer not null default 0, "last_attempt_at" timestamptz null, "next_retry_at" timestamptz null, "delivered_at" timestamptz null, "response_status" integer null, "error_message" text null, "response_body" text null, "metadata_json" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "analytics_dispatch_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_analytics_dispatch_deleted_at" ON "analytics_dispatch" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `create unique index if not exists "IDX_analytics_dispatch_event_destination_unique" on "analytics_dispatch" ("event_id", "destination_code") where "deleted_at" is null;`
    )
    this.addSql(
      `create index if not exists "IDX_analytics_dispatch_delivery_queue" on "analytics_dispatch" ("destination_code", "status", "next_retry_at") where "deleted_at" is null;`
    )
    this.addSql(
      `create index if not exists "IDX_analytics_dispatch_event_id" on "analytics_dispatch" ("event_id") where "deleted_at" is null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "analytics_dispatch" cascade;`)
    this.addSql(`drop table if exists "analytics_event" cascade;`)
  }
}
