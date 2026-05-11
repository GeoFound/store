import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260508042211 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "payment_attempt" ("id" text not null, "cart_id" text null, "order_id" text null, "payment_channel_id" text not null, "provider_code" text not null, "provider_order_id" text null, "amount" integer not null, "currency" text not null, "status" text check ("status" in ('pending', 'paid', 'failed', 'expired', 'partial', 'refunded')) not null default 'pending', "payment_url" text null, "qr_code_url" text null, "expires_at" timestamptz null, "request_payload" jsonb null, "response_payload" jsonb null, "callback_payload" jsonb null, "error_message" text null, "paid_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "payment_attempt_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payment_attempt_deleted_at" ON "payment_attempt" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "payment_channel" ("id" text not null, "code" text not null, "name" text not null, "display_name" text not null, "type" text check ("type" in ('manual', 'aggregate_cn', 'crypto')) not null, "enabled" boolean not null default true, "priority" integer not null default 100, "min_amount" integer null, "max_amount" integer null, "currency" text null, "provider_code" text not null, "config_json" jsonb null, "health_status" text check ("health_status" in ('healthy', 'degraded', 'down')) not null default 'healthy', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "payment_channel_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payment_channel_deleted_at" ON "payment_channel" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "payment_attempt" cascade;`);

    this.addSql(`drop table if exists "payment_channel" cascade;`);
  }

}
