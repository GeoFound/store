import crypto from "crypto"
import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import AccountBatch from "./models/account-batch"
import AccountItem from "./models/account-item"
import type {
  AccountItemStatus,
  CreateCredentialBatchInput,
  ImportCredentialInput,
  ReserveCredentialInput,
} from "./types"

type SafeAccountItem = Record<string, unknown>

class CredentialInventoryModuleService extends MedusaService({
  AccountBatch,
  AccountItem,
}) {
  async listVariantAvailability(input: { variantIds: string[] }) {
    const variantIds = Array.from(
      new Set(input.variantIds.map((variantId) => String(variantId).trim()).filter(Boolean))
    )

    if (!variantIds.length) {
      return []
    }

    const batches = await this.listAccountBatches({
      product_variant_id: variantIds,
    })
    const totalsByVariantId = new Map<
      string,
      {
        total_count: number
        available_count: number
        reserved_count: number
        sold_count: number
        locked_count: number
      }
    >()

    for (const batch of batches) {
      const variantId = String(batch.product_variant_id || "")
      if (!variantId) {
        continue
      }

      const current =
        totalsByVariantId.get(variantId) || {
          total_count: 0,
          available_count: 0,
          reserved_count: 0,
          sold_count: 0,
          locked_count: 0,
        }
      current.total_count += Number(batch.total_count || 0)
      current.available_count += Number(batch.available_count || 0)
      current.reserved_count += Number(batch.reserved_count || 0)
      current.sold_count += Number(batch.sold_count || 0)
      current.locked_count += Number(batch.locked_count || 0)
      totalsByVariantId.set(variantId, current)
    }

    return variantIds.map((variantId) => {
      const totals = totalsByVariantId.get(variantId) || {
        total_count: 0,
        available_count: 0,
        reserved_count: 0,
        sold_count: 0,
        locked_count: 0,
      }

      return {
        variant_id: variantId,
        ...totals,
        is_in_stock: totals.available_count > 0,
      }
    })
  }

  async createCredentialBatch(input: CreateCredentialBatchInput) {
    if (!input.items.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Credential batch must include at least one item"
      )
    }

    const batch = await this.createAccountBatches({
      name: input.name,
      product_variant_id: input.productVariantId,
      status: "active",
      source_note: input.sourceNote || null,
      total_count: input.items.length,
      available_count: input.items.length,
      reserved_count: 0,
      sold_count: 0,
      locked_count: 0,
      cost_price: input.costPrice ?? null,
      currency: input.currency || null,
      metadata_json: input.metadata || null,
    })

    const items = await this.createAccountItems(
      input.items.map((item, index) =>
        this.buildAccountItemPayload({
          item,
          index,
          batchId: batch.id,
          productVariantId: input.productVariantId,
          inheritedCostPrice: input.costPrice,
          inheritedCurrency: input.currency,
        })
      )
    )

    return {
      batch,
      items: items.map((item) => this.sanitizeAccountItem(item)),
    }
  }

  async listAccountItemsSafe(input?: {
    productVariantId?: string
    status?: string
    limit?: number
  }) {
    const items = await this.listAccountItems(
      {
        ...(input?.productVariantId
          ? { product_variant_id: input.productVariantId }
          : {}),
        ...(input?.status ? { status: input.status } : {}),
      },
      {
        take: input?.limit || 50,
        order: {
          created_at: "DESC",
        },
      }
    )

    return items.map((item) => this.sanitizeAccountItem(item))
  }

  async reserveCredentials(input: ReserveCredentialInput) {
    if (input.quantity < 1) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Reservation quantity must be greater than zero"
      )
    }

    const existing = await this.listAccountItems({
      reservation_key: input.reservationKey,
    })

    if (existing.length) {
      return existing.map((item) => this.sanitizeAccountItem(item))
    }

    const available = await this.listAccountItems(
      {
        product_variant_id: input.productVariantId,
        status: "in_stock",
      },
      {
        take: input.quantity,
        order: {
          created_at: "ASC",
        },
      }
    )

    if (available.length < input.quantity) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Not enough credential inventory available"
      )
    }

    const now = new Date()
    const reservedUntil = new Date(
      now.getTime() + (input.ttlSeconds || 15 * 60) * 1000
    )

    const reserved: SafeAccountItem[] = []
    const touchedBatchIds = new Set<string>()
    for (const item of available) {
      const nextItem = await this.updateAccountItems({
        id: item.id,
        status: "reserved",
        reservation_key: input.reservationKey,
        cart_id: input.cartId || null,
        order_id: input.orderId || null,
        reserved_at: now,
        reserved_until: reservedUntil,
      })

      touchedBatchIds.add(String(item.batch_id))
      reserved.push(this.sanitizeAccountItem(nextItem))
    }
    await this.recountBatches(Array.from(touchedBatchIds))

    return reserved
  }

  async markReservationSold(input: { reservationKey: string; orderId?: string }) {
    const reserved = await this.listAccountItems({
      reservation_key: input.reservationKey,
    })

    if (!reserved.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Reservation was not found"
      )
    }

    const soldAt = new Date()
    const sold: SafeAccountItem[] = []
    const touchedBatchIds = new Set<string>()

    for (const item of reserved) {
      if (item.status === "sold") {
        sold.push(this.sanitizeAccountItem(item))
        continue
      }

      if (item.status !== "reserved") {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Cannot sell credential with status ${item.status}`
        )
      }

      const nextItem = await this.updateAccountItems({
        id: item.id,
        status: "sold",
        order_id: input.orderId || item.order_id,
        sold_at: soldAt,
      })

      touchedBatchIds.add(String(item.batch_id))
      sold.push(this.sanitizeAccountItem(nextItem))
    }
    await this.recountBatches(Array.from(touchedBatchIds))

    return sold
  }

  async releaseReservation(input: {
    reservationKey: string
    onlyExpiredBefore?: Date
  }) {
    const reserved = await this.listAccountItems({
      reservation_key: input.reservationKey,
      status: "reserved",
    })

    const released: SafeAccountItem[] = []
    const touchedBatchIds = new Set<string>()
    const onlyExpiredBeforeTime = input.onlyExpiredBefore?.getTime()
    for (const item of reserved) {
      if (
        typeof onlyExpiredBeforeTime === "number" &&
        (!item.reserved_until ||
          new Date(item.reserved_until).getTime() > onlyExpiredBeforeTime)
      ) {
        continue
      }

      const nextItem = await this.updateAccountItems({
        id: item.id,
        status: "in_stock",
        reservation_key: null,
        cart_id: null,
        order_id: null,
        reserved_at: null,
        reserved_until: null,
      })

      touchedBatchIds.add(String(item.batch_id))
      released.push(this.sanitizeAccountItem(nextItem))
    }
    await this.recountBatches(Array.from(touchedBatchIds))

    return released
  }

  async releaseExpiredReservations(now = new Date()) {
    const released: SafeAccountItem[] = []
    for (const reservationKey of await this.listExpiredReservationKeys(now)) {
      released.push(
        ...(await this.releaseReservation({
          reservationKey,
          onlyExpiredBefore: now,
        }))
      )
    }

    return released
  }

  async listExpiredReservationKeys(now = new Date()) {
    const reserved = await this.listAccountItems({
      status: "reserved",
    })
    const keys = new Set<string>()

    for (const item of reserved) {
      if (!item.reservation_key || !item.reserved_until) {
        continue
      }

      if (new Date(item.reserved_until).getTime() <= now.getTime()) {
        keys.add(String(item.reservation_key))
      }
    }

    return Array.from(keys)
  }

  async revealCredential(itemId: string) {
    const item = await this.retrieveAccountItem(itemId)

    return {
      item: this.sanitizeAccountItem(item),
      credential: this.decryptCredential(item.credential_blob),
    }
  }

  async markDelivered(input: { accountItemId: string; deliveredAt?: Date }) {
    const item = await this.retrieveAccountItem(input.accountItemId)

    if (!["sold", "locked"].includes(item.status)) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Cannot mark credential with status ${item.status} as delivered`
      )
    }

    return this.sanitizeAccountItem(
      await this.updateAccountItems({
        id: item.id,
        delivered_at: input.deliveredAt || new Date(),
      })
    )
  }

  private buildAccountItemPayload(input: {
    item: ImportCredentialInput
    index: number
    batchId: string
    productVariantId: string
    inheritedCostPrice?: number
    inheritedCurrency?: string
  }) {
    const accountIdentifier =
      input.item.accountIdentifier ||
      this.createCredentialIdentifier(input.item.credential)
    const displayLabel =
      input.item.displayLabel || `Credential ${input.index + 1}`

    return {
      batch_id: input.batchId,
      product_variant_id: input.productVariantId,
      status: "in_stock" as AccountItemStatus,
      account_identifier: accountIdentifier,
      display_label: displayLabel,
      credential_blob: this.encryptCredential(input.item.credential),
      credential_version: 1,
      source_note: input.item.sourceNote || null,
      cost_price: input.item.costPrice ?? input.inheritedCostPrice ?? null,
      currency: input.item.currency || input.inheritedCurrency || null,
      reservation_key: null,
      cart_id: null,
      order_id: null,
      reserved_at: null,
      reserved_until: null,
      sold_at: null,
      delivered_at: null,
      metadata_json: input.item.metadata || null,
    }
  }

  private async recountBatch(batchId: string) {
    const items = await this.listAccountItems({
      batch_id: batchId,
    })

    const counts = items.reduce(
      (acc, item) => {
        acc.total_count += 1
        if (item.status === "in_stock") {
          acc.available_count += 1
        }
        if (item.status === "reserved") {
          acc.reserved_count += 1
        }
        if (item.status === "sold") {
          acc.sold_count += 1
        }
        if (item.status === "locked") {
          acc.locked_count += 1
        }
        return acc
      },
      {
        total_count: 0,
        available_count: 0,
        reserved_count: 0,
        sold_count: 0,
        locked_count: 0,
      }
    )

    await this.updateAccountBatches({
      id: batchId,
      ...counts,
      status: counts.available_count > 0 ? "active" : "depleted",
    })
  }

  private async recountBatches(batchIds: string[]) {
    const uniqueBatchIds = Array.from(
      new Set(batchIds.map((batchId) => String(batchId).trim()).filter(Boolean))
    )

    await Promise.all(uniqueBatchIds.map((batchId) => this.recountBatch(batchId)))
  }

  private sanitizeAccountItem(item: Record<string, unknown>) {
    const { credential_blob: _credentialBlob, ...safeItem } = item
    return safeItem
  }

  private encryptCredential(credential: Record<string, unknown> | string) {
    const key = this.getEncryptionKey()
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
    const plaintext =
      typeof credential === "string" ? credential : JSON.stringify(credential)
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ])
    const authTag = cipher.getAuthTag()

    return JSON.stringify({
      alg: "aes-256-gcm",
      iv: iv.toString("base64"),
      tag: authTag.toString("base64"),
      data: encrypted.toString("base64"),
    })
  }

  private decryptCredential(blob: string) {
    const parsed = JSON.parse(blob) as {
      alg: string
      iv: string
      tag: string
      data: string
    }

    if (parsed.alg !== "aes-256-gcm") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Unsupported credential encryption algorithm"
      )
    }

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      this.getEncryptionKey(),
      Buffer.from(parsed.iv, "base64")
    )
    decipher.setAuthTag(Buffer.from(parsed.tag, "base64"))

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(parsed.data, "base64")),
      decipher.final(),
    ]).toString("utf8")

    try {
      return JSON.parse(decrypted)
    } catch {
      return decrypted
    }
  }

  private getEncryptionKey() {
    const value = process.env.CREDENTIAL_ENCRYPTION_KEY

    if (!value) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "CREDENTIAL_ENCRYPTION_KEY is required"
      )
    }

    const key = /^[0-9a-f]{64}$/i.test(value)
      ? Buffer.from(value, "hex")
      : Buffer.from(value, "base64")

    if (key.length !== 32) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "CREDENTIAL_ENCRYPTION_KEY must decode to 32 bytes"
      )
    }

    return key
  }

  private createCredentialIdentifier(credential: Record<string, unknown> | string) {
    const source =
      typeof credential === "string" ? credential : JSON.stringify(credential)

    return crypto.createHash("sha256").update(source).digest("hex").slice(0, 16)
  }
}

export default CredentialInventoryModuleService
