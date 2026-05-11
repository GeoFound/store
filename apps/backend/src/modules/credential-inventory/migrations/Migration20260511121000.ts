import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260511121000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create index if not exists "IDX_account_batch_variant_status" on "account_batch" ("product_variant_id", "status") where "deleted_at" is null;`
    )
    this.addSql(
      `create unique index if not exists "IDX_account_item_variant_identifier_unique" on "account_item" ("product_variant_id", "account_identifier") where "deleted_at" is null;`
    )
    this.addSql(
      `create index if not exists "IDX_account_item_variant_status" on "account_item" ("product_variant_id", "status") where "deleted_at" is null;`
    )
    this.addSql(
      `create index if not exists "IDX_account_item_reservation_key" on "account_item" ("reservation_key") where "deleted_at" is null and "reservation_key" is not null;`
    )
    this.addSql(
      `create index if not exists "IDX_account_item_reserved_until" on "account_item" ("reserved_until") where "deleted_at" is null and "status" = 'reserved';`
    )
    this.addSql(
      `create index if not exists "IDX_account_item_order_id" on "account_item" ("order_id") where "deleted_at" is null and "order_id" is not null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_account_item_order_id";`)
    this.addSql(`drop index if exists "IDX_account_item_reserved_until";`)
    this.addSql(`drop index if exists "IDX_account_item_reservation_key";`)
    this.addSql(`drop index if exists "IDX_account_item_variant_status";`)
    this.addSql(`drop index if exists "IDX_account_item_variant_identifier_unique";`)
    this.addSql(`drop index if exists "IDX_account_batch_variant_status";`)
  }
}
