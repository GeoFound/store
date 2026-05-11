import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260508070421 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "account_batch" ("id" text not null, "name" text not null, "product_variant_id" text not null, "status" text check ("status" in ('active', 'closed', 'depleted', 'archived')) not null default 'active', "source_note" text null, "total_count" integer not null default 0, "available_count" integer not null default 0, "reserved_count" integer not null default 0, "sold_count" integer not null default 0, "locked_count" integer not null default 0, "cost_price" integer null, "currency" text null, "metadata_json" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "account_batch_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_account_batch_deleted_at" ON "account_batch" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "account_item" ("id" text not null, "batch_id" text not null, "product_variant_id" text not null, "status" text check ("status" in ('in_stock', 'reserved', 'sold', 'locked', 'refunded')) not null default 'in_stock', "account_identifier" text not null, "display_label" text not null, "credential_blob" text not null, "credential_version" integer not null default 1, "source_note" text null, "cost_price" integer null, "currency" text null, "reservation_key" text null, "cart_id" text null, "order_id" text null, "reserved_at" timestamptz null, "reserved_until" timestamptz null, "sold_at" timestamptz null, "delivered_at" timestamptz null, "metadata_json" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "account_item_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_account_item_deleted_at" ON "account_item" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "account_batch" cascade;`);

    this.addSql(`drop table if exists "account_item" cascade;`);
  }

}
