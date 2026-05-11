import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260511120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "payment_channel" drop constraint if exists "payment_channel_type_check";`
    )
    this.addSql(
      `create unique index if not exists "IDX_payment_channel_code_unique" on "payment_channel" ("code") where "deleted_at" is null;`
    )
    this.addSql(
      `create index if not exists "IDX_payment_channel_provider_enabled" on "payment_channel" ("provider_code", "enabled", "health_status") where "deleted_at" is null;`
    )
    this.addSql(
      `create unique index if not exists "IDX_payment_attempt_provider_order_unique" on "payment_attempt" ("provider_code", "provider_order_id") where "deleted_at" is null and "provider_order_id" is not null;`
    )
    this.addSql(
      `create index if not exists "IDX_payment_attempt_cart_status" on "payment_attempt" ("cart_id", "status") where "deleted_at" is null;`
    )
    this.addSql(
      `create index if not exists "IDX_payment_attempt_order_id" on "payment_attempt" ("order_id") where "deleted_at" is null and "order_id" is not null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_payment_attempt_order_id";`)
    this.addSql(`drop index if exists "IDX_payment_attempt_cart_status";`)
    this.addSql(`drop index if exists "IDX_payment_attempt_provider_order_unique";`)
    this.addSql(`drop index if exists "IDX_payment_channel_provider_enabled";`)
    this.addSql(`drop index if exists "IDX_payment_channel_code_unique";`)
  }
}
