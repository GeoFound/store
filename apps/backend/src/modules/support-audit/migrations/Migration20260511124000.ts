import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260511124000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create index if not exists "IDX_after_sale_status_created" on "after_sale" ("status", "created_at") where "deleted_at" is null;`
    )
    this.addSql(
      `create index if not exists "IDX_after_sale_delivery" on "after_sale" ("delivery_id") where "deleted_at" is null;`
    )
    this.addSql(
      `create index if not exists "IDX_audit_log_entity_created" on "audit_log" ("entity_type", "entity_id", "created_at") where "deleted_at" is null;`
    )
    this.addSql(
      `create index if not exists "IDX_audit_log_action_created" on "audit_log" ("action", "created_at") where "deleted_at" is null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_audit_log_action_created";`)
    this.addSql(`drop index if exists "IDX_audit_log_entity_created";`)
    this.addSql(`drop index if exists "IDX_after_sale_delivery";`)
    this.addSql(`drop index if exists "IDX_after_sale_status_created";`)
  }
}
