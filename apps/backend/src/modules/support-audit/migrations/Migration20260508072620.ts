import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260508072620 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "after_sale" ("id" text not null, "delivery_id" text not null, "order_id" text null, "cart_id" text null, "payment_attempt_id" text null, "account_item_id" text null, "customer_email" text null, "reason" text check ("reason" in ('not_working', 'wrong_item', 'duplicate', 'refund', 'other')) not null default 'other', "message" text not null, "status" text check ("status" in ('open', 'processing', 'resolved', 'rejected', 'closed')) not null default 'open', "admin_note" text null, "result" text check ("result" in ('pending', 'replaced', 'refunded', 'rejected', 'resolved')) not null default 'pending', "handled_by" text null, "handled_at" timestamptz null, "metadata_json" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "after_sale_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_after_sale_deleted_at" ON "after_sale" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "audit_log" ("id" text not null, "actor_type" text check ("actor_type" in ('admin', 'customer', 'guest', 'system', 'webhook')) not null default 'system', "actor_id" text null, "action" text not null, "entity_type" text not null, "entity_id" text null, "risk_level" text check ("risk_level" in ('low', 'medium', 'high')) not null default 'low', "ip_address" text null, "user_agent" text null, "metadata_json" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "audit_log_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_audit_log_deleted_at" ON "audit_log" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "after_sale" cascade;`);

    this.addSql(`drop table if exists "audit_log" cascade;`);
  }

}
