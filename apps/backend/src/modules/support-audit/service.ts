import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import AfterSale from "./models/after-sale"
import AuditLog from "./models/audit-log"
import type {
  CreateAfterSaleInput,
  UpdateAfterSaleInput,
  WriteAuditLogInput,
} from "./types"
import {
  type AuditRetentionConfig,
  getAuditRetentionConfig,
} from "./config"

class SupportAuditModuleService extends MedusaService({
  AfterSale,
  AuditLog,
}) {
  async writeAuditLog(input: WriteAuditLogInput) {
    return this.createAuditLogs({
      actor_type: input.actorType,
      actor_id: input.actorId || null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId || null,
      risk_level: input.riskLevel || "low",
      ip_address: input.ipAddress || null,
      user_agent: input.userAgent || null,
      metadata_json: input.metadata || null,
    })
  }

  async createAfterSale(input: CreateAfterSaleInput) {
    if (!input.message.trim()) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "After-sales message is required"
      )
    }

    return this.createAfterSales({
      delivery_id: input.deliveryId,
      order_id: input.orderId || null,
      cart_id: input.cartId || null,
      payment_attempt_id: input.paymentAttemptId || null,
      account_item_id: input.accountItemId || null,
      customer_email: input.customerEmail || null,
      reason: input.reason || "other",
      message: input.message,
      status: "open",
      admin_note: null,
      result: "pending",
      handled_by: null,
      handled_at: null,
      metadata_json: input.metadata || null,
    })
  }

  async updateAfterSale(input: UpdateAfterSaleInput) {
    const afterSale = await this.retrieveAfterSale(input.id)

    return this.updateAfterSales({
      id: afterSale.id,
      status: input.status || afterSale.status,
      result: input.result || afterSale.result,
      admin_note:
        typeof input.adminNote === "string"
          ? input.adminNote
          : afterSale.admin_note,
      handled_by: input.handledBy || afterSale.handled_by,
      handled_at:
        input.status && input.status !== "open" ? new Date() : afterSale.handled_at,
    })
  }

  async listAfterSalesSafe(input?: {
    status?: string
    deliveryId?: string
    limit?: number
  }) {
    return this.listAfterSales(
      {
        ...(input?.status ? { status: input.status } : {}),
        ...(input?.deliveryId ? { delivery_id: input.deliveryId } : {}),
      },
      {
        take: input?.limit || 50,
        order: {
          created_at: "DESC",
        },
      }
    )
  }

  async listAuditLogsSafe(input?: {
    action?: string
    entityType?: string
    entityId?: string
    limit?: number
  }) {
    return this.listAuditLogs(
      {
        ...(input?.action ? { action: input.action } : {}),
        ...(input?.entityType ? { entity_type: input.entityType } : {}),
        ...(input?.entityId ? { entity_id: input.entityId } : {}),
      },
      {
        take: input?.limit || 100,
        order: {
          created_at: "DESC",
        },
      }
    )
  }

  async pruneAuditLogs(input?: {
    now?: Date
    config?: AuditRetentionConfig
  }) {
    const config = input?.config || getAuditRetentionConfig()

    if (!config.enabled) {
      return {
        deleted_count: 0,
        enabled: false,
        cutoff_at: null,
      }
    }

    const now = input?.now || new Date()
    const cutoff = new Date(
      now.getTime() - config.retentionDays * 24 * 60 * 60 * 1000
    )
    const oldest = await this.listAuditLogs(
      {},
      {
        take: config.batchSize,
        order: {
          created_at: "ASC",
        },
      }
    )
    const expiredIds = oldest
      .filter((entry) => isBeforeCutoff(entry.created_at, cutoff))
      .map((entry) => String(entry.id))

    if (expiredIds.length) {
      await this.deleteAuditLogs(expiredIds)
    }

    return {
      deleted_count: expiredIds.length,
      enabled: true,
      cutoff_at: cutoff.toISOString(),
      retention_days: config.retentionDays,
      batch_size: config.batchSize,
    }
  }
}

export default SupportAuditModuleService

function isBeforeCutoff(value: unknown, cutoff: Date) {
  const date = value instanceof Date ? value : new Date(String(value))

  return Number.isFinite(date.getTime()) && date.getTime() < cutoff.getTime()
}
