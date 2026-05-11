import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260511170000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "order_access_token" add column if not exists "failed_attempts" integer not null default 0;`
    )
    this.addSql(
      `alter table if exists "order_access_token" add column if not exists "last_failed_at" timestamptz null;`
    )
    this.addSql(
      `alter table if exists "order_access_token" add column if not exists "blocked_until" timestamptz null;`
    )
    this.addSql(`drop index if exists "IDX_order_access_token_hash_unique";`)
    this.addSql(
      `create unique index if not exists "IDX_order_access_token_view_hash_unique" on "order_access_token" ("token_hash") where "deleted_at" is null and "purpose" = 'view_order';`
    )
    this.addSql(
      `create index if not exists "IDX_order_access_token_purpose_hash" on "order_access_token" ("purpose", "token_hash") where "deleted_at" is null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_order_access_token_purpose_hash";`)
    this.addSql(`drop index if exists "IDX_order_access_token_view_hash_unique";`)
    this.addSql(
      `create unique index if not exists "IDX_order_access_token_hash_unique" on "order_access_token" ("token_hash") where "deleted_at" is null;`
    )
    this.addSql(
      `alter table if exists "order_access_token" drop column if exists "blocked_until";`
    )
    this.addSql(
      `alter table if exists "order_access_token" drop column if exists "last_failed_at";`
    )
    this.addSql(
      `alter table if exists "order_access_token" drop column if exists "failed_attempts";`
    )
  }
}
