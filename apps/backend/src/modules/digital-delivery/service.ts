import crypto from "crypto"
import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import OrderDelivery from "./models/order-delivery"
import type { CreateManualDeliveryInput } from "./types"
import {
  decodeEncryptionKey,
  resolveEncryptionKeyRing,
} from "../../utils/runtime-secrets"
import {
  getDeliveryHandler,
  resolveProductFulfillmentPolicy,
} from "../../platform/delivery"

class DigitalDeliveryModuleService extends MedusaService({
  OrderDelivery,
}) {
  async createManualDelivery(input: CreateManualDeliveryInput) {
    return this.createManualDeliveryRecord(input)
  }

  async createDelivery(input: CreateManualDeliveryInput) {
    const policyPlan = await resolveProductFulfillmentPolicy({
      code: input.fulfillmentPolicyCode || undefined,
      productVariantId: input.productVariantId || input.accountItemId || "manual",
      productType: input.productType ?? null,
      metadata: input.metadata || null,
    })

    const handlerCode =
      input.deliveryHandlerCode || policyPlan?.deliveryHandlerCode || "manual"
    const handler = getDeliveryHandler(handlerCode)

    if (!handler) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Delivery handler ${handlerCode} is not registered`
      )
    }

    return handler.createDelivery(input)
  }

  async ensureDefaultDeliveryHandlers() {
    if (getDeliveryHandler("manual")) {
      return
    }

    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Manual delivery handler is not registered"
    )
  }

  private async createManualDeliveryRecord(input: CreateManualDeliveryInput) {
    const existing = input.accountItemId
      ? await this.listOrderDeliveries({
          account_item_id: input.accountItemId,
        })
      : []
    const activeDelivery = input.accountItemId
      ? existing.find((delivery) =>
          ["delivered", "confirmed"].includes(delivery.delivery_status)
        )
      : null

    if (activeDelivery) {
      return {
        delivery: this.sanitizeDelivery(activeDelivery),
        accessToken: null,
      }
    }

    const accessToken = this.createAccessToken()
    const deliveredAt = new Date()
    const delivery = await this.createOrderDeliveries({
      order_id: input.orderId || null,
      cart_id: input.cartId || null,
      payment_attempt_id: input.paymentAttemptId || null,
      order_item_id: input.orderItemId || null,
      account_item_id: input.accountItemId || null,
      delivery_status: "delivered",
      delivery_payload_encrypted: this.encryptPayload(
        input.deliveryPayload || {}
      ),
      delivery_payload_version: 1,
      access_token_hash: this.hashAccessToken(accessToken),
      access_token_hint: accessToken.slice(-6),
      delivered_by: input.deliveredBy || null,
      delivered_at: deliveredAt,
      buyer_confirmed_at: null,
      delivery_note: input.deliveryNote || null,
      retry_count: 0,
      replacement_for_delivery_id: null,
      metadata_json: input.metadata || null,
    })

    return {
      delivery: this.sanitizeDelivery(delivery),
      accessToken,
    }
  }

  async listDeliveriesSafe(input?: {
    status?: string
    orderId?: string
    cartId?: string
    paymentAttemptId?: string
    limit?: number
  }) {
    const deliveries = await this.listOrderDeliveries(
      {
        ...(input?.status ? { delivery_status: input.status } : {}),
        ...(input?.orderId ? { order_id: input.orderId } : {}),
        ...(input?.cartId ? { cart_id: input.cartId } : {}),
        ...(input?.paymentAttemptId
          ? { payment_attempt_id: input.paymentAttemptId }
          : {}),
      },
      {
        take: input?.limit || 50,
        order: {
          created_at: "DESC",
        },
      }
    )

    return deliveries.map((delivery) => this.sanitizeDelivery(delivery))
  }

  async retrieveDeliveryByAccessToken(accessToken: string) {
    const delivery = await this.retrieveDeliveryRecordByAccessToken(accessToken)

    return this.buildDeliveryLookupResult(delivery)
  }

  async confirmDelivery(accessToken: string) {
    const delivery = await this.retrieveDeliveryRecordByAccessToken(accessToken)

    return this.confirmDeliveryRecord(delivery)
  }

  async listOrderDeliveriesDetailed(orderId: string) {
    const deliveries = await this.listOrderDeliveries(
      {
        order_id: orderId,
      },
      {
        take: 100,
        order: {
          created_at: "ASC",
        },
      }
    )

    return deliveries.map((delivery) => this.buildDeliveryLookupResult(delivery))
  }

  async retrieveOrderDeliveryForOrder(input: {
    orderId: string
    deliveryId: string
  }) {
    const delivery = await this.retrieveDeliveryRecordForOrder(input)

    return this.buildDeliveryLookupResult(delivery)
  }

  async confirmOrderDelivery(input: { orderId: string; deliveryId: string }) {
    const delivery = await this.retrieveDeliveryRecordForOrder(input)

    return this.confirmDeliveryRecord(delivery)
  }

  private sanitizeDelivery(delivery: Record<string, unknown>) {
    const {
      delivery_payload_encrypted: _payload,
      access_token_hash: _hash,
      ...safeDelivery
    } = delivery

    return safeDelivery
  }

  private buildDeliveryLookupResult(delivery: Record<string, unknown>) {
    return {
      delivery: this.sanitizeDelivery(delivery),
      payload: this.decryptPayload(String(delivery.delivery_payload_encrypted)),
    }
  }

  private async retrieveDeliveryRecordByAccessToken(accessToken: string) {
    const deliveries = await this.listOrderDeliveries({
      access_token_hash: this.hashAccessToken(accessToken),
    })
    const delivery = deliveries[0]

    if (!delivery) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Delivery was not found"
      )
    }

    return delivery
  }

  private async retrieveDeliveryRecordForOrder(input: {
    orderId: string
    deliveryId: string
  }) {
    const deliveries = await this.listOrderDeliveries({
      id: input.deliveryId,
      order_id: input.orderId,
    })
    const delivery = deliveries[0]

    if (!delivery) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Delivery was not found"
      )
    }

    return delivery
  }

  private async confirmDeliveryRecord(delivery: Record<string, any>) {
    if (delivery.delivery_status === "confirmed") {
      return this.sanitizeDelivery(delivery)
    }

    const nextDelivery = await this.updateOrderDeliveries({
      id: delivery.id,
      delivery_status: "confirmed",
      buyer_confirmed_at: new Date(),
    })

    return this.sanitizeDelivery(nextDelivery)
  }

  private encryptPayload(payload: Record<string, unknown> | string) {
    const key = this.getEncryptionKey()
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
    const plaintext =
      typeof payload === "string" ? payload : JSON.stringify(payload)
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

  private decryptPayload(blob: string) {
    let parsed: {
      alg?: string
      iv?: string
      tag?: string
      data?: string
    }

    try {
      parsed = JSON.parse(blob) as {
        alg?: string
        iv?: string
        tag?: string
        data?: string
      }
    } catch {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Delivery payload is not valid JSON"
      )
    }

    if (parsed.alg !== "aes-256-gcm") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Unsupported delivery encryption algorithm"
      )
    }

    if (!parsed.iv || !parsed.tag || !parsed.data) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Delivery payload is missing encryption fields"
      )
    }

    for (const key of this.getDecryptionKeys()) {
      try {
        const decipher = crypto.createDecipheriv(
          "aes-256-gcm",
          key,
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
      } catch {
        continue
      }
    }

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Delivery payload could not be decrypted with configured encryption keys"
    )
  }

  private getEncryptionKey() {
    return this.getDecryptionKeys()[0]
  }

  private getDecryptionKeys() {
    try {
      const keyValues = resolveEncryptionKeyRing("DELIVERY_ENCRYPTION_KEY", {
        fallbackName: "CREDENTIAL_ENCRYPTION_KEY",
        previousNames: [
          "DELIVERY_ENCRYPTION_KEY_PREVIOUS",
          "CREDENTIAL_ENCRYPTION_KEY_PREVIOUS",
        ],
      })

      return keyValues.map((value) =>
        decodeEncryptionKey(value, "DELIVERY_ENCRYPTION_KEY")
      )
    } catch (error) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        error instanceof Error
          ? error.message
          : "Delivery encryption key configuration is invalid"
      )
    }
  }

  private createAccessToken() {
    return `dlv_${crypto.randomBytes(24).toString("base64url")}`
  }

  private hashAccessToken(accessToken: string) {
    return crypto.createHash("sha256").update(accessToken).digest("hex")
  }
}

export default DigitalDeliveryModuleService
