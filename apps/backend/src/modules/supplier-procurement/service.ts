import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import { getSupplierProvider, type SupplierMappingSnapshot, type SupplierProvider } from "../../platform/supplier"
import SupplierProcurementOrder from "./models/supplier-procurement-order"
import SupplierProductMapping from "./models/supplier-product-mapping"
import type { CreateSupplierDeliveryInput, ListDueSupplierProcurementsInput, ListSupplierMappingsInput, ListSupplierProcurementsInput, SupplierProcurementStatus, SupplierProductMappingInput } from "./types"
import { buildDefaultSupplierDeliveryPayload, normalizeCurrencyCode, normalizeDate, normalizeLimit, normalizeOptionalNumber, normalizeQuantity, normalizeRecord, redactSensitiveRecord, requireText, toNullableText, toOptionalText } from "./service-helpers"
import { decryptStoredFulfillmentPayload, encryptFulfillmentPayload } from "./fulfillment-payload-codec"
import { prepareSupplierDeliveryRecord, type PreparedSupplierDeliveryRecord } from "./delivery-record"
import { buildSafeSupplierRequestPayload, resolveSupplierIdempotencyKey } from "./request-payload"
import { isSupplierAutoProcurementEnabled } from "../../platform/checkout-policy"
import { initialSupplierProcurementStatus, prepareSupplierManualReviewDelivery, shouldQueueSupplierManualReview, supplierAutoProcurementError, supplierAutoProcurementMetadata } from "./auto-procurement-policy"

type SupplierProcurementOrderRecord = Record<string, any>
type SupplierProductMappingRecord = Record<string, any>
export type { PreparedSupplierDeliveryRecord }

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

  async listDueProcurementsForRetry(
    input: ListDueSupplierProcurementsInput = {}
  ) {
    const now = input.now || new Date()
    const statuses = input.statuses?.length
      ? input.statuses
      : (["pending", "failed", "needs_review"] satisfies SupplierProcurementStatus[])
    const limit = normalizeLimit(input.limit, 50)
    const due: SupplierProcurementOrderRecord[] = []
    const seen = new Set<string>()

    for (const status of statuses) {
      const orders = await this.listSupplierProcurementOrders(
        {
          status,
        },
        {
          take: limit,
          order: {
            next_retry_at: "ASC",
            created_at: "ASC",
          },
        }
      )

      for (const order of orders) {
        const id = toOptionalText(order.id)
        const retryAt = normalizeDate(order.next_retry_at)

        if (!id || seen.has(id) || !retryAt || retryAt.getTime() > now.getTime()) {
          continue
        }

        seen.add(id)
        due.push(order)

        if (due.length >= limit) {
          return due
        }
      }
    }

    return due
  }

  async createSupplierDelivery(input: CreateSupplierDeliveryInput) {
    if (!input.scope) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Supplier delivery scope is required"
      )
    }

    const context = await this.resolveSupplierContext(input)
    const autoProcurementEnabled = isSupplierAutoProcurementEnabled()
    const existing = await this.retrieveProcurementByIdempotencyKey(
      context.idempotencyKey
    )
    const order =
      existing ||
      (await this.createSupplierProcurementOrders({
        idempotency_key: context.idempotencyKey,
        provider_code: context.providerCode,
        provider_order_id: null,
        status: initialSupplierProcurementStatus(autoProcurementEnabled),
        product_variant_id: context.productVariantId || null,
        order_id: input.orderId || null,
        cart_id: input.cartId || null,
        payment_attempt_id: input.paymentAttemptId || null,
        order_item_id: input.orderItemId || null,
        quantity: context.quantity,
        currency: context.currency,
        cost_amount: null,
        cost_currency: null,
        request_payload: buildSafeSupplierRequestPayload(context),
        response_payload: null,
        fulfillment_payload_encrypted: null,
        fulfillment_payload_version: 1,
        error_message: supplierAutoProcurementError(autoProcurementEnabled),
        retry_count: 0,
        next_retry_at: null,
        fulfilled_at: null,
        metadata_json: supplierAutoProcurementMetadata({
          metadata: context.metadata,
          enabled: autoProcurementEnabled,
          mappingId: context.mapping?.id,
        }),
      }))

    if (
      shouldQueueSupplierManualReview({
        enabled: autoProcurementEnabled,
        order,
      })
    ) {
      return prepareSupplierManualReviewDelivery(input, order)
    }

    const provider = getSupplierProvider(context.providerCode, {
      productTypeCode: input.productType || undefined,
    })

    if (!provider) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Supplier provider ${context.providerCode} is not registered`
      )
    }

    const procurement = await this.processProcurementOrder({
      order,
      provider,
      context,
    })

    return prepareSupplierDeliveryRecord(input, procurement.order, {
      deliveryPayload: procurement.deliveryPayload,
      deliveryStatus: procurement.deliveryStatus,
      message: procurement.message,
    })
  }

  async retryProcurementOrder(input: {
    id: string
    scope: CreateSupplierDeliveryInput["scope"]
    forceRetry?: boolean
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
      forceRetry: input.forceRetry ?? true,
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

    return {
      procurement: procurement.order,
      delivery: prepareSupplierDeliveryRecord(
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
      ),
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
        deliveryPayload: decryptStoredFulfillmentPayload(order),
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
        fulfillment_payload_encrypted: encryptFulfillmentPayload(
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

  async rememberDeliveryRecord(input: {
    procurementOrderId: string
    deliveryId: string
  }) {
    const order = await this.retrieveSupplierProcurementOrder(
      input.procurementOrderId
    )
    const orderMetadata = normalizeRecord(order.metadata_json)

    if (orderMetadata.delivery_id === input.deliveryId) {
      return order
    }

    return this.updateSupplierProcurementOrders({
      id: input.procurementOrderId,
      metadata_json: {
        ...orderMetadata,
        delivery_id: input.deliveryId,
      },
    })
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
      idempotencyKey: resolveSupplierIdempotencyKey(input, providerCode),
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

}

export default SupplierProcurementModuleService
