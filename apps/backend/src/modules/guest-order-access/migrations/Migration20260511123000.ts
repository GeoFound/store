import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260511123000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create unique index if not exists "IDX_order_access_token_hash_unique" on "order_access_token" ("token_hash") where "deleted_at" is null;`
    )
    this.addSql(
      `create index if not exists "IDX_order_access_token_order_purpose" on "order_access_token" ("order_id", "purpose") where "deleted_at" is null;`
    )
    this.addSql(
      `create index if not exists "IDX_order_access_token_email_purpose" on "order_access_token" ("customer_email", "purpose") where "deleted_at" is null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_order_access_token_email_purpose";`)
    this.addSql(`drop index if exists "IDX_order_access_token_order_purpose";`)
    this.addSql(`drop index if exists "IDX_order_access_token_hash_unique";`)
  }
}
