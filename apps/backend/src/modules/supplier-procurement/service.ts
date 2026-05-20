import crypto from "crypto"
import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import {
  decodeEncryptionKey,
  resolveEncryptionKeyRing,
} from "../../utils/runtime-secrets"
import {
  getSupplierProvider,
  type SupplierMappingSnapshot,
  type SupplierProvider,
} from "../../platform/supplier"
import { DIGITAL_DELIVERY_MODULE } from "../digital-delivery"
import type DigitalDeliveryModuleService from "../digital-delivery/service"
import SupplierProcurementOrder from "./models/supplier-procurement-order"
import SupplierProductMapping from "./models/supplier-product-mapping"
import type {
  CreateSupplierDeliveryInput,
  ListSupplierMappingsInput,
  ListSupplierProcurementsInput,
  SupplierProductMappingInput,
} from "./types"

type SupplierProcurementOrderRecord = Record<string, any>
type SupplierProductMappingRecord = Record<string, any>
type ResolvedSupplierContext = {
  scope: NonNullable<CreateSupplierDeliveryInput["scope"]>
  idempotencyKey: string
  providerCode: string
  providerSku: string
  productVariantId: string
  quantity: number
  orderId: string | null
  cartId: string | null
  paymentAttemptId: string | null
  orderItemId: string | null
  customerEmail: string | null
  currency: string | null
  regionCode: string | null
  metadata: Record<string, unknown>
  mapping: SupplierMappingSnapshot | null
}

class SupplierProcurementModuleService extends MedusaService({
  SupplierProductMapping,
  SupplierProcurementOrder,
}) {
  async listMappingsSafe(input?: ListSupplierMappingsInput) {
    return this.listSupplierProductMappings(
      {
        ...(input?.productVariantId
          ? { product_variant_id: input.productVariantId }
          : {}),
        ...(input?.providerCode ? { provider_code: input.providerCode } : {}),
        ...(typeof input?.enabled === "boolean" ? { enabled: input.enabled } : {}),
      },
      {
        take: normalizeLimit(input?.limit, 100),
        order: {
          priority: "ASC",
          created_at: "DESC",
        },
      }
    )
  }

  async upsertProductMapping(input: SupplierProductMappingInput) {
    const productVariantId = requireText(
      input.productVariantId,
      "productVariantId"
    )
    const providerCode = requireText(input.providerCode, "providerCode")
    const providerSku = requireText(input.providerSku, "providerSku")
    const existing = await this.findProductMapping({
      productVariantId,
      providerCode,
      providerSku,
    })
    const payload = {
      product_variant_id: productVariantId,
      provider_code: providerCode,
      provider_sku: providerSku,
      provider_product_id: toNullableText(input.providerProductId),
      provider_variant_id: toNullableText(input.providerVariantId),
      region_code: toNullableText(input.regionCode),
      currency: normalizeCurrencyCode(input.currency) || null,
      enabled: input.enabled ?? true,
      priority: input.priority ?? 100,
      cost_price: normalizeOptionalNumber(input.costPrice),
      list_price: normalizeOptionalNumber(input.listPrice),
      metadata_json: input.metadata || null,
    }

    if (existing) {
      return this.updateSupplierProductMappings({
        id: existing.id,
        ...payload,
      })
    }

    return this.createSupplierProductMappings(payload)
  }

  async listProcurementsSafe(input?: ListSupplierProcurementsInput) {
    return this.listSupplierProcurementOrders(
      {
        ...(input?.status ? { status: input.status } : {}),
        ...(input?.providerCode ? { provider_code: input.providerCode } : {}),
        ...(input?.productVariantId
          ? { product_variant_id: input.productVariantId }
          : {}),
        ...(input?.orderId ? { order_id: input.orderId } : {}),
        ...(input?.paymentAttemptId
          ? { payment_attempt_id: input.paymentAttemptId }
          : {}),
      },
      {
        take: normalizeLimit(input?.limit, 100),
        order: {
          created_at: "DESC",
        },
      }
    )
  }

  async createSupplierDelivery(input: CreateSupplierDeliveryInput) {
    if (!input.scope) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Supplier delivery scope is required"
      )
    }

    const context = await this.resolveSupplierContext(input)
    const provider = getSupplierProvider(context.providerCode, {
      productTypeCode: input.productType || undefined,
    })

    if (!provider) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Supplier provider ${context.providerCode} is not registered`
      )
    }

    const existing = await this.retrieveProcurementByIdempotencyKey(
      context.idempotencyKey
    )
    const order =
      existing ||
      (await this.createSupplierProcurementOrders({
        idempotency_key: context.idempotencyKey,
        provider_code: context.providerCode,
        provider_order_id: null,
        status: "pending",
        product_variant_id: context.productVariantId || null,
        order_id: input.orderId || null,
        cart_id: input.cartId || null,
        payment_attempt_id: input.paymentAttemptId || null,
        order_item_id: input.orderItemId || null,
        quantity: context.quantity,
        currency: context.currency,
        cost_amount: null,
        cost_currency: null,
        request_payload: this.buildSafeRequestPayload(context),
        response_payload: null,
        fulfillment_payload_encrypted: null,
        fulfillment_payload_version: 1,
        error_message: null,
        retry_count: 0,
        next_retry_at: null,
        fulfilled_at: null,
        metadata_json: {
          ...context.metadata,
          supplier_mapping_id: context.mapping?.id || null,
        },
      }))

    const procurement = await this.processProcurementOrder({
      order,
      provider,
      context,
    })

    return this.createDeliveryRecord(input, procurement.order, {
      deliveryPayload: procurement.deliveryPayload,
      deliveryStatus: procurement.deliveryStatus,
      message: procurement.message,
    })
  }

  async retryProcurementOrder(input: {
    id: string
    scope: CreateSupplierDeliveryInput["scope"]
  }) {
    if (!input.scope) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Supplier retry scope is required"
      )
    }

    const order = await this.retrieveSupplierProcurementOrder(input.id)
    const provider = getSupplierProvider(order.provider_code)

    if (!provider) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Supplier provider ${order.provider_code} is not registered`
      )
    }

    const context = this.buildContextFromOrder(order, input.scope)
    const procurement = await this.processProcurementOrder({
      order,
      provider,
      context,
      forceRetry: true,
    })

    const deliveryId = toOptionalText(
      normalizeRecord(order.metadata_json).delivery_id
    )

    if (!deliveryId || procurement.deliveryStatus !== "delivered") {
      return {
        procurement: procurement.order,
        delivery: null,
      }
    }

    const result = await this.createDeliveryRecord(
      {
        scope: input.scope,
        deliveryId,
        orderId: toOptionalText(order.order_id) || undefined,
        cartId: toOptionalText(order.cart_id) || undefined,
        paymentAttemptId: toOptionalText(order.payment_attempt_id) || undefined,
        orderItemId: toOptionalText(order.order_item_id) || undefined,
        productVariantId: toOptionalText(order.product_variant_id) || undefined,
        deliveryHandlerCode: "supplier-procurement",
        deliveryStatus: "delivered",
        deliveredBy: "system",
        metadata: normalizeRecord(order.metadata_json),
      },
      procurement.order,
      {
        deliveryPayload: procurement.deliveryPayload,
        deliveryStatus: procurement.deliveryStatus,
        message: procurement.message,
      }
    )

    return {
      procurement: procurement.order,
      delivery: result.delivery,
      accessToken: result.accessToken,
    }
  }

  private async processProcurementOrder(input: {
    order: SupplierProcurementOrderRecord
    provider: SupplierProvider
    context: ResolvedSupplierContext
    forceRetry?: boolean
  }) {
    const order = input.order

    if (order.status === "fulfilled") {
      return {
        order,
        deliveryStatus: "delivered" as const,
        deliveryPayload: this.decryptStoredFulfillmentPayload(order),
        message: "Supplier procurement already fulfilled",
      }
    }

    if (
      ["processing", "pending", "failed", "needs_review"].includes(order.status) &&
      order.provider_order_id &&
      input.provider.retrieveFulfillment
    ) {
      try {
        const retrieved = await input.provider.retrieveFulfillment({
          scope: input.context.scope,
          providerOrderId: order.provider_order_id,
          providerSku: input.context.providerSku,
          metadata: input.context.metadata,
          mapping: input.context.mapping,
        })

        return this.applyProviderResult(order, retrieved)
      } catch (error) {
        if (!input.forceRetry) {
          return {
            order,
            deliveryStatus: "pending" as const,
            deliveryPayload: undefined,
            message:
              error instanceof Error
                ? error.message
                : "Supplier fulfillment lookup failed",
          }
        }
      }
    }

    const processing = await this.updateSupplierProcurementOrders({
      id: order.id,
      status: "processing",
      retry_count: Number(order.retry_count || 0) + (input.forceRetry ? 1 : 0),
      error_message: null,
      next_retry_at: null,
    })

    try {
      const result = await input.provider.procure({
        scope: input.context.scope,
        idempotencyKey: input.context.idempotencyKey,
        providerSku: input.context.providerSku,
        productVariantId: input.context.productVariantId || undefined,
        quantity: input.context.quantity,
        orderId: input.context.orderId,
        cartId: input.context.cartId,
        paymentAttemptId: input.context.paymentAttemptId,
        orderItemId: input.context.orderItemId,
        customerEmail: input.context.customerEmail,
        currency: input.context.currency,
        regionCode: input.context.regionCode,
        metadata: input.context.metadata,
        mapping: input.context.mapping,
      })

      return this.applyProviderResult(processing, result)
    } catch (error) {
      const failed = await this.updateSupplierProcurementOrders({
        id: processing.id,
        status: "failed",
        error_message:
          error instanceof Error ? error.message : "Supplier procurement failed",
        next_retry_at: null,
      })

      throw Object.assign(
        new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          failed.error_message || "Supplier procurement failed"
        ),
        {
          procurementOrderId: failed.id,
        }
      )
    }
  }

  private async applyProviderResult(
    order: SupplierProcurementOrderRecord,
    result: {
      providerOrderId?: string | null
      status: "fulfilled" | "pending" | "failed"
      deliveryPayload?: Record<string, unknown> | string
      costAmount?: number | null
      costCurrency?: string | null
      raw?: Record<string, unknown> | null
      message?: string | null
      retryAfter?: Date | string | null
    }
  ) {
    if (result.status === "fulfilled") {
      const deliveryPayload =
        result.deliveryPayload ||
        buildDefaultSupplierDeliveryPayload(order, result)
      const fulfilled = await this.updateSupplierProcurementOrders({
        id: order.id,
        status: "fulfilled",
        provider_order_id:
          toNullableText(result.providerOrderId) || order.provider_order_id || null,
        cost_amount: normalizeOptionalNumber(result.costAmount),
        cost_currency:
          normalizeCurrencyCode(result.costCurrency) || order.cost_currency || null,
        response_payload: redactSensitiveRecord(result.raw || {}),
        fulfillment_payload_encrypted: this.encryptFulfillmentPayload(
          deliveryPayload
        ),
        fulfillment_payload_version: 1,
        error_message: null,
        next_retry_at: null,
        fulfilled_at: new Date(),
      })

      return {
        order: fulfilled,
        deliveryStatus: "delivered" as const,
        deliveryPayload,
        message: result.message || "Supplier procurement fulfilled",
      }
    }

    if (result.status === "pending") {
      const pending = await this.updateSupplierProcurementOrders({
        id: order.id,
        status: "pending",
        provider_order_id:
          toNullableText(result.providerOrderId) || order.provider_order_id || null,
        cost_amount: normalizeOptionalNumber(result.costAmount),
        cost_currency:
          normalizeCurrencyCode(result.costCurrency) || order.cost_currency || null,
        response_payload: redactSensitiveRecord(result.raw || {}),
        error_message: null,
        next_retry_at: normalizeDate(result.retryAfter),
      })

      return {
        order: pending,
        deliveryStatus: "pending" as const,
        deliveryPayload: undefined,
        message: result.message || "Supplier procurement is pending",
      }
    }

    const failed = await this.updateSupplierProcurementOrders({
      id: order.id,
      status: "failed",
      provider_order_id:
        toNullableText(result.providerOrderId) || order.provider_order_id || null,
      response_payload: redactSensitiveRecord(result.raw || {}),
      error_message: result.message || "Supplier procurement failed",
      next_retry_at: normalizeDate(result.retryAfter),
    })

    throw Object.assign(
      new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        failed.error_message || "Supplier procurement failed"
      ),
      {
        procurementOrderId: failed.id,
      }
    )
  }

  private async createDeliveryRecord(
    input: CreateSupplierDeliveryInput,
    order: SupplierProcurementOrderRecord,
    result: {
      deliveryPayload?: Record<string, unknown> | string
      deliveryStatus: "pending" | "delivered"
      message?: string | null
    }
  ) {
    if (!input.scope) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Supplier delivery scope is required"
      )
    }

    const deliveryService: DigitalDeliveryModuleService = input.scope.resolve(
      DIGITAL_DELIVERY_MODULE
    )
    const orderMetadata = normalizeRecord(order.metadata_json)
    const deliveryPayload =
      result.deliveryPayload ||
      ({
        status: "pending",
        message: result.message || "Supplier procurement is pending.",
        supplier_procurement_order_id: order.id,
        supplier_provider: order.provider_code,
        supplier_provider_order_id: order.provider_order_id || null,
      } satisfies Record<string, unknown>)
    const deliveryResult = await deliveryService.createManualDelivery({
      ...input,
      accountItemId: null,
      deliveryHandlerCode: "supplier-procurement",
      deliveryStatus: result.deliveryStatus,
      deliveryPayload,
      deliveredBy: input.deliveredBy || "system",
      metadata: {
        ...normalizeRecord(input.metadata),
        ...orderMetadata,
        supplier_procurement_order_id: order.id,
        supplier_provider: order.provider_code,
        supplier_provider_order_id: order.provider_order_id || null,
      },
    })

    const deliveryId = toOptionalText(deliveryResult.delivery.id)
    if (deliveryId && orderMetadata.delivery_id !== deliveryId) {
      await this.updateSupplierProcurementOrders({
        id: order.id,
        metadata_json: {
          ...orderMetadata,
          delivery_id: deliveryId,
        },
      })
    }

    return deliveryResult
  }

  private async resolveSupplierContext(
    input: CreateSupplierDeliveryInput
  ): Promise<ResolvedSupplierContext> {
    const metadata = normalizeRecord(input.metadata)
    const productVariantId =
      toOptionalText(input.productVariantId) ||
      toOptionalText(metadata.product_variant_id) ||
      toOptionalText(metadata.productVariantId)
    const requestedProviderCode =
      toOptionalText(metadata.supplier_provider) ||
      toOptionalText(metadata.supplierProvider) ||
      toOptionalText(metadata.provider_code) ||
      toOptionalText(metadata.providerCode)
    const requestedProviderSku =
      toOptionalText(metadata.supplier_sku) ||
      toOptionalText(metadata.supplierSku) ||
      toOptionalText(metadata.provider_sku) ||
      toOptionalText(metadata.providerSku)
    const mapping = await this.resolveProductMapping({
      productVariantId,
      providerCode: requestedProviderCode,
      providerSku: requestedProviderSku,
    })
    const providerCode =
      requestedProviderCode || toOptionalText(mapping?.provider_code)
    const providerSku = requestedProviderSku || toOptionalText(mapping?.provider_sku)

    if (!productVariantId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Supplier procurement requires productVariantId"
      )
    }

    if (!providerCode || !providerSku) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Supplier mapping is missing for variant ${productVariantId}`
      )
    }

    return {
      scope: input.scope!,
      idempotencyKey: this.resolveIdempotencyKey(input, providerCode),
      providerCode,
      providerSku,
      productVariantId,
      quantity: normalizeQuantity(metadata.quantity) || 1,
      orderId: input.orderId || null,
      cartId: input.cartId || null,
      paymentAttemptId: input.paymentAttemptId || null,
      orderItemId: input.orderItemId || null,
      customerEmail:
        toOptionalText(metadata.customer_email) ||
        toOptionalText(metadata.customerEmail) ||
        null,
      currency:
        normalizeCurrencyCode(metadata.supplier_currency) ||
        normalizeCurrencyCode(metadata.currency) ||
        normalizeCurrencyCode(mapping?.currency) ||
        null,
      regionCode:
        toNullableText(metadata.supplier_region) ||
        toNullableText(metadata.region_code) ||
        toNullableText(mapping?.region_code),
      metadata: {
        ...normalizeRecord(mapping?.metadata_json),
        ...metadata,
      },
      mapping: mapping
        ? ({
            id: mapping.id,
            product_variant_id: mapping.product_variant_id,
            provider_code: mapping.provider_code,
            provider_sku: mapping.provider_sku,
            provider_product_id: mapping.provider_product_id,
            provider_variant_id: mapping.provider_variant_id,
            region_code: mapping.region_code,
            currency: mapping.currency,
            cost_price: mapping.cost_price,
            list_price: mapping.list_price,
            metadata_json: normalizeRecord(mapping.metadata_json),
          } satisfies SupplierMappingSnapshot)
        : null,
    }
  }

  private buildContextFromOrder(
    order: SupplierProcurementOrderRecord,
    scope: NonNullable<CreateSupplierDeliveryInput["scope"]>
  ): ResolvedSupplierContext {
    const request = normalizeRecord(order.request_payload)
    const metadata = normalizeRecord(order.metadata_json)

    return {
      scope,
      idempotencyKey: String(order.idempotency_key),
      providerCode: String(order.provider_code),
      providerSku: requireText(request.provider_sku, "provider_sku"),
      productVariantId: requireText(order.product_variant_id, "product_variant_id"),
      quantity: normalizeQuantity(order.quantity) || 1,
      orderId: toOptionalText(order.order_id) || null,
      cartId: toOptionalText(order.cart_id) || null,
      paymentAttemptId: toOptionalText(order.payment_attempt_id) || null,
      orderItemId: toOptionalText(order.order_item_id) || null,
      customerEmail: toOptionalText(request.customer_email) || null,
      currency: normalizeCurrencyCode(order.currency) || null,
      regionCode: toOptionalText(request.region_code) || null,
      metadata,
      mapping: null,
    }
  }

  private async resolveProductMapping(input: {
    productVariantId: string
    providerCode?: string
    providerSku?: string
  }) {
    if (!input.productVariantId) {
      return null
    }

    const mappings = await this.listSupplierProductMappings(
      {
        product_variant_id: input.productVariantId,
        enabled: true,
        ...(input.providerCode ? { provider_code: input.providerCode } : {}),
        ...(input.providerSku ? { provider_sku: input.providerSku } : {}),
      },
      {
        take: 20,
        order: {
          priority: "ASC",
          created_at: "DESC",
        },
      }
    )

    return mappings[0] || null
  }

  private async findProductMapping(input: {
    productVariantId: string
    providerCode: string
    providerSku: string
  }) {
    const mappings = await this.listSupplierProductMappings({
      product_variant_id: input.productVariantId,
      provider_code: input.providerCode,
      provider_sku: input.providerSku,
    })

    return mappings[0] || null
  }

  private async retrieveProcurementByIdempotencyKey(idempotencyKey: string) {
    const orders = await this.listSupplierProcurementOrders({
      idempotency_key: idempotencyKey,
    })

    return orders[0] || null
  }

  private resolveIdempotencyKey(
    input: CreateSupplierDeliveryInput,
    providerCode: string
  ) {
    const metadata = normalizeRecord(input.metadata)
    const explicit =
      toOptionalText(metadata.supplier_idempotency_key) ||
      toOptionalText(metadata.supplierIdempotencyKey)

    if (explicit) {
      return explicit
    }

    const fulfillmentKey =
      toOptionalText(metadata.fulfillment_key) ||
      toOptionalText(metadata.fulfillmentKey) ||
      input.orderItemId ||
      input.productVariantId ||
      "item"

    return [
      "supplier",
      providerCode,
      input.paymentAttemptId || input.orderId || input.cartId || "manual",
      fulfillmentKey,
    ].join(":")
  }

  private buildSafeRequestPayload(
    context: Awaited<ReturnType<SupplierProcurementModuleService["resolveSupplierContext"]>>
  ) {
    return {
      provider_code: context.providerCode,
      provider_sku: context.providerSku,
      product_variant_id: context.productVariantId,
      quantity: context.quantity,
      customer_email: context.customerEmail,
      currency: context.currency,
      region_code: context.regionCode,
      metadata: redactSensitiveRecord(context.metadata),
    }
  }

  private encryptFulfillmentPayload(payload: Record<string, unknown> | string) {
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

  private decryptStoredFulfillmentPayload(order: SupplierProcurementOrderRecord) {
    const blob = toOptionalText(order.fulfillment_payload_encrypted)

    if (!blob) {
      return buildDefaultSupplierDeliveryPayload(order, {
        status: "fulfilled",
      })
    }

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
        "Supplier fulfillment payload is not valid JSON"
      )
    }

    if (parsed.alg !== "aes-256-gcm" || !parsed.iv || !parsed.tag || !parsed.data) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Supplier fulfillment payload is missing encryption fields"
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
      "Supplier fulfillment payload could not be decrypted"
    )
  }

  private getEncryptionKey() {
    return this.getDecryptionKeys()[0]
  }

  private getDecryptionKeys() {
    try {
      const keyValues = resolveEncryptionKeyRing("SUPPLIER_ENCRYPTION_KEY", {
        fallbackName: "DELIVERY_ENCRYPTION_KEY",
        previousNames: [
          "SUPPLIER_ENCRYPTION_KEY_PREVIOUS",
          "DELIVERY_ENCRYPTION_KEY_PREVIOUS",
        ],
      })

      return keyValues.map((value) =>
        decodeEncryptionKey(value, "SUPPLIER_ENCRYPTION_KEY")
      )
    } catch (error) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        error instanceof Error
          ? error.message
          : "Supplier encryption key configuration is invalid"
      )
    }
  }
}

export default SupplierProcurementModuleService

function buildDefaultSupplierDeliveryPayload(
  order: SupplierProcurementOrderRecord,
  result: { status: string; providerOrderId?: string | null; message?: string | null }
) {
  return {
    status: result.status,
    message: result.message || "Supplier procurement completed.",
    supplier_procurement_order_id: order.id,
    supplier_provider: order.provider_code,
    supplier_provider_order_id:
      toNullableText(result.providerOrderId) || order.provider_order_id || null,
  }
}

function normalizeLimit(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback
  }

  return Math.max(1, Math.min(Math.floor(value), 500))
}

function normalizeQuantity(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.floor(value))
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 0
  }

  return 0
}

function normalizeOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function normalizeDate(value: unknown) {
  if (value instanceof Date) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value)
    return Number.isFinite(parsed.getTime()) ? parsed : null
  }

  return null
}

function normalizeCurrencyCode(value: unknown) {
  if (typeof value !== "string") {
    return ""
  }

  const normalized = value.trim().toLowerCase()

  return /^[a-z]{3}$/.test(normalized) ? normalized : ""
}

function normalizeRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

function toOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function toNullableText(value: unknown) {
  return toOptionalText(value) || null
}

function requireText(value: unknown, field: string) {
  const normalized = toOptionalText(value)

  if (!normalized) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `${field} is required`
    )
  }

  return normalized
}

function redactSensitiveRecord(value: Record<string, unknown>) {
  const redacted: Record<string, unknown> = {}

  for (const [key, entry] of Object.entries(value)) {
    if (isSensitiveKey(key)) {
      redacted[key] = "[redacted]"
      continue
    }

    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      redacted[key] = redactSensitiveRecord(entry as Record<string, unknown>)
      continue
    }

    if (Array.isArray(entry)) {
      redacted[key] = entry.map((item) =>
        item && typeof item === "object"
          ? redactSensitiveRecord(item as Record<string, unknown>)
          : item
      )
      continue
    }

    redacted[key] = entry
  }

  return redacted
}

function isSensitiveKey(key: string) {
  return /secret|token|password|pin|code|key|credential|card_number|cardnumber/i.test(
    key
  )
}
