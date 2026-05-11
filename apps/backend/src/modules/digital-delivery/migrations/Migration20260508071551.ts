import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260508071551 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "order_delivery" ("id" text not null, "order_id" text null, "cart_id" text null, "payment_attempt_id" text null, "order_item_id" text null, "account_item_id" text not null, "delivery_status" text check ("delivery_status" in ('pending', 'delivered', 'confirmed', 'replaced', 'refunded')) not null default 'pending', "delivery_payload_encrypted" text not null, "delivery_payload_version" integer not null default 1, "access_token_hash" text not null, "access_token_hint" text not null, "delivered_by" text null, "delivered_at" timestamptz null, "buyer_confirmed_at" timestamptz null, "delivery_note" text null, "retry_count" integer not null default 0, "replacement_for_delivery_id" text null, "metadata_json" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "order_delivery_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_order_delivery_deleted_at" ON "order_delivery" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "order_delivery" cascade;`);
  }

}
