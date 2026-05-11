import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260511200000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "marketing_campaign" ("id" text not null, "code" text not null, "name" text not null, "description" text null, "status" text check ("status" in ('draft', 'active', 'paused', 'archived')) not null default 'draft', "starts_at" timestamptz null, "ends_at" timestamptz null, "budget_limit" integer null, "spent_amount" integer not null default 0, "metadata_json" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_campaign_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_marketing_campaign_deleted_at" ON "marketing_campaign" ("deleted_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "marketing_offer" ("id" text not null, "campaign_id" text null, "code" text not null, "name" text not null, "type" text check ("type" in ('coupon', 'bundle', 'referral', 'upsell', 'email_flow', 'custom')) not null default 'custom', "status" text check ("status" in ('draft', 'active', 'paused', 'archived')) not null default 'draft', "priority" integer not null default 100, "starts_at" timestamptz null, "ends_at" timestamptz null, "conditions_json" jsonb null, "reward_json" jsonb null, "metadata_json" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_offer_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_marketing_offer_deleted_at" ON "marketing_offer" ("deleted_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "marketing_coupon" ("id" text not null, "campaign_id" text null, "offer_id" text null, "code" text not null, "status" text check ("status" in ('active', 'disabled', 'expired')) not null default 'active', "max_redemptions" integer null, "max_redemptions_per_email" integer null, "redeemed_count" integer not null default 0, "starts_at" timestamptz null, "expires_at" timestamptz null, "metadata_json" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_coupon_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_marketing_coupon_deleted_at" ON "marketing_coupon" ("deleted_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "marketing_coupon_redemption" ("id" text not null, "coupon_id" text not null, "coupon_code" text not null, "payment_attempt_id" text null, "order_id" text null, "customer_email" text null, "status" text check ("status" in ('reserved', 'confirmed', 'released')) not null default 'reserved', "reserved_at" timestamptz null, "confirmed_at" timestamptz null, "released_at" timestamptz null, "metadata_json" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_coupon_redemption_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_marketing_coupon_redemption_deleted_at" ON "marketing_coupon_redemption" ("deleted_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "marketing_referral_link" ("id" text not null, "campaign_id" text null, "code" text not null, "referrer_id" text null, "referrer_email" text null, "status" text check ("status" in ('active', 'disabled')) not null default 'active', "max_uses" integer null, "used_count" integer not null default 0, "landing_path" text null, "metadata_json" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_referral_link_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_marketing_referral_link_deleted_at" ON "marketing_referral_link" ("deleted_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "marketing_referral_reward" ("id" text not null, "referral_link_id" text not null, "referee_order_id" text null, "referee_payment_attempt_id" text null, "referrer_reward_type" text check ("referrer_reward_type" in ('coupon', 'credit', 'commission')) not null default 'coupon', "reward_value" text null, "status" text check ("status" in ('pending', 'issued', 'revoked')) not null default 'pending', "issued_at" timestamptz null, "metadata_json" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_referral_reward_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_marketing_referral_reward_deleted_at" ON "marketing_referral_reward" ("deleted_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "marketing_touchpoint" ("id" text not null, "cart_id" text null, "payment_attempt_id" text null, "order_id" text null, "customer_email" text null, "event_name" text not null, "coupon_code" text null, "referral_code" text null, "source" text null, "medium" text null, "campaign" text null, "content" text null, "term" text null, "metadata_json" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_touchpoint_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_marketing_touchpoint_deleted_at" ON "marketing_touchpoint" ("deleted_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create unique index if not exists "IDX_marketing_campaign_code_unique" on "marketing_campaign" ("code") where "deleted_at" is null;`
    )
    this.addSql(
      `create unique index if not exists "IDX_marketing_offer_code_unique" on "marketing_offer" ("code") where "deleted_at" is null;`
    )
    this.addSql(
      `create unique index if not exists "IDX_marketing_coupon_code_unique" on "marketing_coupon" ("code") where "deleted_at" is null;`
    )
    this.addSql(
      `create unique index if not exists "IDX_marketing_referral_link_code_unique" on "marketing_referral_link" ("code") where "deleted_at" is null;`
    )
    this.addSql(
      `create unique index if not exists "IDX_marketing_redemption_attempt_unique" on "marketing_coupon_redemption" ("payment_attempt_id") where "deleted_at" is null and "payment_attempt_id" is not null;`
    )
    this.addSql(
      `create unique index if not exists "IDX_marketing_referral_reward_unique_order" on "marketing_referral_reward" ("referral_link_id", "referee_order_id") where "deleted_at" is null and "referee_order_id" is not null;`
    )
    this.addSql(
      `create index if not exists "IDX_marketing_coupon_status_expiry" on "marketing_coupon" ("status", "expires_at") where "deleted_at" is null;`
    )
    this.addSql(
      `create index if not exists "IDX_marketing_redemption_coupon_status" on "marketing_coupon_redemption" ("coupon_id", "status") where "deleted_at" is null;`
    )
    this.addSql(
      `create index if not exists "IDX_marketing_redemption_coupon_email" on "marketing_coupon_redemption" ("coupon_id", "customer_email") where "deleted_at" is null and "customer_email" is not null;`
    )
    this.addSql(
      `create index if not exists "IDX_marketing_touchpoint_event_created" on "marketing_touchpoint" ("event_name", "created_at") where "deleted_at" is null;`
    )
    this.addSql(
      `create index if not exists "IDX_marketing_touchpoint_attempt" on "marketing_touchpoint" ("payment_attempt_id") where "deleted_at" is null and "payment_attempt_id" is not null;`
    )
    this.addSql(
      `create index if not exists "IDX_marketing_touchpoint_order" on "marketing_touchpoint" ("order_id") where "deleted_at" is null and "order_id" is not null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_marketing_touchpoint_order";`)
    this.addSql(`drop index if exists "IDX_marketing_touchpoint_attempt";`)
    this.addSql(`drop index if exists "IDX_marketing_touchpoint_event_created";`)
    this.addSql(`drop index if exists "IDX_marketing_redemption_coupon_email";`)
    this.addSql(`drop index if exists "IDX_marketing_redemption_coupon_status";`)
    this.addSql(`drop index if exists "IDX_marketing_coupon_status_expiry";`)
    this.addSql(`drop index if exists "IDX_marketing_referral_reward_unique_order";`)
    this.addSql(`drop index if exists "IDX_marketing_redemption_attempt_unique";`)
    this.addSql(`drop index if exists "IDX_marketing_referral_link_code_unique";`)
    this.addSql(`drop index if exists "IDX_marketing_coupon_code_unique";`)
    this.addSql(`drop index if exists "IDX_marketing_offer_code_unique";`)
    this.addSql(`drop index if exists "IDX_marketing_campaign_code_unique";`)

    this.addSql(`drop table if exists "marketing_touchpoint" cascade;`)
    this.addSql(`drop table if exists "marketing_referral_reward" cascade;`)
    this.addSql(`drop table if exists "marketing_referral_link" cascade;`)
    this.addSql(`drop table if exists "marketing_coupon_redemption" cascade;`)
    this.addSql(`drop table if exists "marketing_coupon" cascade;`)
    this.addSql(`drop table if exists "marketing_offer" cascade;`)
    this.addSql(`drop table if exists "marketing_campaign" cascade;`)
  }
}
