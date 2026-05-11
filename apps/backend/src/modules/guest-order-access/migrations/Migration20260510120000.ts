import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260510120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "order_access_token" ("id" text not null, "order_id" text not null, "customer_email" text not null, "purpose" text check ("purpose" in ('view_order', 'claim_order')) not null default 'view_order', "token_hash" text not null, "token_hint" text null, "expires_at" timestamptz null, "used_at" timestamptz null, "revoked_at" timestamptz null, "metadata_json" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "order_access_token_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_order_access_token_deleted_at" ON "order_access_token" ("deleted_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "order_access_token" cascade;`)
  }
}
