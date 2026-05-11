import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260511122000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "order_delivery" alter column "account_item_id" drop not null;`
    )
    this.addSql(
      `create unique index if not exists "IDX_order_delivery_access_token_hash_unique" on "order_delivery" ("access_token_hash") where "deleted_at" is null;`
    )
    this.addSql(`
      with ranked_active_deliveries as (
        select
          "id",
          first_value("id") over (
            partition by "account_item_id"
            order by "created_at" desc, "id" desc
          ) as "kept_delivery_id",
          row_number() over (
            partition by "account_item_id"
            order by "created_at" desc, "id" desc
          ) as "delivery_rank"
        from "order_delivery"
        where "deleted_at" is null
          and "account_item_id" is not null
          and "delivery_status" in ('delivered', 'confirmed')
      )
      update "order_delivery" as "delivery"
      set
        "delivery_status" = 'replaced',
        "replacement_for_delivery_id" = "ranked_active_deliveries"."kept_delivery_id",
        "metadata_json" = coalesce("delivery"."metadata_json", '{}'::jsonb) || jsonb_build_object(
          'migration', 'Migration20260511122000',
          'migration_reason', 'dedupe_active_account_item_delivery',
          'migration_replaced_by_delivery_id', "ranked_active_deliveries"."kept_delivery_id"
        ),
        "updated_at" = now()
      from "ranked_active_deliveries"
      where "delivery"."id" = "ranked_active_deliveries"."id"
        and "ranked_active_deliveries"."delivery_rank" > 1;
    `)
    this.addSql(
      `create unique index if not exists "IDX_order_delivery_active_account_item_unique" on "order_delivery" ("account_item_id") where "deleted_at" is null and "account_item_id" is not null and "delivery_status" in ('delivered', 'confirmed');`
    )
    this.addSql(
      `create index if not exists "IDX_order_delivery_order_status" on "order_delivery" ("order_id", "delivery_status") where "deleted_at" is null;`
    )
    this.addSql(
      `create index if not exists "IDX_order_delivery_payment_attempt" on "order_delivery" ("payment_attempt_id") where "deleted_at" is null and "payment_attempt_id" is not null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_order_delivery_payment_attempt";`)
    this.addSql(`drop index if exists "IDX_order_delivery_order_status";`)
    this.addSql(`drop index if exists "IDX_order_delivery_active_account_item_unique";`)
    this.addSql(`drop index if exists "IDX_order_delivery_access_token_hash_unique";`)
    this.addSql(
      `alter table if exists "order_delivery" alter column "account_item_id" set not null;`
    )
  }
}
