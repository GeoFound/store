import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260519120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "supplier_product_mapping" (
        "id" text not null,
        "product_variant_id" text not null,
        "provider_code" text not null,
        "provider_sku" text not null,
        "provider_product_id" text null,
        "provider_variant_id" text null,
        "region_code" text null,
        "currency" text null,
        "enabled" boolean not null default true,
        "priority" numeric not null default 100,
        "cost_price" numeric null,
        "list_price" numeric null,
        "metadata_json" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "supplier_product_mapping_pkey" primary key ("id")
      );
    `)

    this.addSql(`
      create table if not exists "supplier_procurement_order" (
        "id" text not null,
        "idempotency_key" text not null,
        "provider_code" text not null,
        "provider_order_id" text null,
        "status" text not null default 'pending',
        "product_variant_id" text null,
        "order_id" text null,
        "cart_id" text null,
        "payment_attempt_id" text null,
        "order_item_id" text null,
        "quantity" numeric not null default 1,
        "currency" text null,
        "cost_amount" numeric null,
        "cost_currency" text null,
        "request_payload" jsonb null,
        "response_payload" jsonb null,
        "fulfillment_payload_encrypted" text null,
        "fulfillment_payload_version" numeric not null default 1,
        "error_message" text null,
        "retry_count" numeric not null default 0,
        "next_retry_at" timestamptz null,
        "fulfilled_at" timestamptz null,
        "metadata_json" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "supplier_procurement_order_pkey" primary key ("id")
      );
    `)

    this.addSql(
      `create unique index if not exists "IDX_supplier_mapping_variant_provider_sku_unique" on "supplier_product_mapping" ("product_variant_id", "provider_code", "provider_sku") where "deleted_at" is null;`
    )
    this.addSql(
      `create index if not exists "IDX_supplier_mapping_variant_enabled" on "supplier_product_mapping" ("product_variant_id", "enabled", "priority") where "deleted_at" is null;`
    )
    this.addSql(
      `create unique index if not exists "IDX_supplier_procurement_idempotency_unique" on "supplier_procurement_order" ("idempotency_key") where "deleted_at" is null;`
    )
    this.addSql(
      `create unique index if not exists "IDX_supplier_procurement_provider_order_unique" on "supplier_procurement_order" ("provider_code", "provider_order_id") where "deleted_at" is null and "provider_order_id" is not null;`
    )
    this.addSql(
      `create index if not exists "IDX_supplier_procurement_status_retry" on "supplier_procurement_order" ("status", "next_retry_at") where "deleted_at" is null;`
    )
    this.addSql(
      `create index if not exists "IDX_supplier_procurement_order_id" on "supplier_procurement_order" ("order_id") where "deleted_at" is null and "order_id" is not null;`
    )
    this.addSql(
      `create index if not exists "IDX_supplier_procurement_payment_attempt" on "supplier_procurement_order" ("payment_attempt_id") where "deleted_at" is null and "payment_attempt_id" is not null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_supplier_procurement_payment_attempt";`)
    this.addSql(`drop index if exists "IDX_supplier_procurement_order_id";`)
    this.addSql(`drop index if exists "IDX_supplier_procurement_status_retry";`)
    this.addSql(`drop index if exists "IDX_supplier_procurement_provider_order_unique";`)
    this.addSql(`drop index if exists "IDX_supplier_procurement_idempotency_unique";`)
    this.addSql(`drop index if exists "IDX_supplier_mapping_variant_enabled";`)
    this.addSql(`drop index if exists "IDX_supplier_mapping_variant_provider_sku_unique";`)
    this.addSql(`drop table if exists "supplier_procurement_order";`)
    this.addSql(`drop table if exists "supplier_product_mapping";`)
  }
}
