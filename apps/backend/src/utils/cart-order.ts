import { MedusaError } from "@medusajs/framework/utils"
import type { CreateOrderDTO } from "@medusajs/framework/types"

type GenericRecord = Record<string, unknown>

type CartOrderSource = {
  id?: string | null
  region_id?: string | null
  sales_channel_id?: string | null
  email?: string | null
  currency_code?: string | null
  locale?: string | null
  total?: number | string | null
  metadata?: GenericRecord | null
  customer?: {
    id?: string | null
  } | null
  shipping_address?: GenericRecord | null
  billing_address?: GenericRecord | null
  items?: Array<GenericRecord | null | undefined>
  [key: string]: unknown
}

export const CART_ORDER_QUERY_FIELDS = [
  "id",
  "completed_at",
  "region_id",
  "sales_channel_id",
  "email",
  "currency_code",
  "locale",
  "total",
  "subtotal",
  "metadata",
  "customer_id",
  "customer.id",
  "shipping_address.*",
  "billing_address.*",
  "items.*",
  "items.quantity",
  "items.unit_price",
  "items.total",
  "items.subtotal",
  "items.tax_lines.*",
  "items.adjustments.*",
  "items.metadata",
  "items.variant.id",
  "items.variant.title",
  "items.variant.sku",
  "items.variant.barcode",
  "items.variant.thumbnail",
  "items.variant.requires_shipping",
  "items.variant.is_discountable",
  "items.variant.metadata",
  "items.variant.product.id",
  "items.variant.product.title",
  "items.variant.product.description",
  "items.variant.product.subtitle",
  "items.variant.product.handle",
  "items.variant.product.thumbnail",
  "items.variant.product.discountable",
  "items.variant.product.is_giftcard",
  "items.variant.product.metadata",
  "items.variant.product.type.id",
  "items.variant.product.type.value",
  "items.variant.product.collection.title",
]

export function buildOrderFromCart(input: {
  cart: CartOrderSource
  customerId?: string | null
  transactionReferenceId?: string
}) {
  const cart = input.cart

  if (typeof cart.email !== "string" || !cart.email) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Cart email is required before order creation"
    )
  }

  if (typeof cart.currency_code !== "string" || !cart.currency_code) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Cart currency is required before order creation"
    )
  }

  const customerId = toOptionalString(input.customerId) ||
    toOptionalString(cart.customer?.id) ||
    undefined

  const items = (cart.items || [])
    .filter((item): item is GenericRecord => Boolean(item))
    .map((item) => buildOrderItem(item))

  if (!items.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Cart must contain at least one item"
    )
  }

  return {
    region_id: toOptionalString(cart.region_id),
    customer_id: customerId,
    sales_channel_id: toOptionalString(cart.sales_channel_id),
    status: "pending",
    email: cart.email,
    currency_code: cart.currency_code,
    locale: cart.locale || null,
    ...(sanitizeAddress(cart.shipping_address)
      ? { shipping_address: sanitizeAddress(cart.shipping_address) }
      : {}),
    ...(sanitizeAddress(cart.billing_address)
      ? { billing_address: sanitizeAddress(cart.billing_address) }
      : {}),
    no_notification: false,
    items,
    metadata: cart.metadata || null,
    ...(input.transactionReferenceId
      ? {
          transactions: [
            {
              amount:
                (typeof cart.total === "number"
                  ? cart.total
                  : Number(cart.total || 0)) || items.reduce(sumItemAmount, 0),
              currency_code: cart.currency_code,
              reference: "payment_attempt",
              reference_id: input.transactionReferenceId,
            },
          ],
        }
      : {}),
  } satisfies CreateOrderDTO
}

function buildOrderItem(item: GenericRecord) {
  const variant = toRecord(item.variant)
  const product = toRecord(variant.product)
  const productType = toRecord(product.type)
  const productCollection = toRecord(product.collection)

  return {
    quantity: item.quantity,
    title: item.title || product.title,
    subtitle: item.subtitle || variant.title,
    thumbnail: item.thumbnail || variant.thumbnail || product.thumbnail,
    product_id: product.id || item.product_id,
    product_title: item.product_title || product.title,
    product_description: item.product_description || product.description,
    product_subtitle: item.product_subtitle || product.subtitle,
    product_type: item.product_type || productType.value || null,
    product_type_id: item.product_type_id || productType.id || null,
    product_collection: item.product_collection || productCollection.title || null,
    product_handle: item.product_handle || product.handle,
    variant_id: item.variant_id || variant.id,
    variant_sku: item.variant_sku || variant.sku,
    variant_barcode: item.variant_barcode || variant.barcode,
    variant_title: item.variant_title || variant.title,
    variant_option_values: toRecord(item.variant_option_values),
    requires_shipping:
      typeof item.requires_shipping === "boolean"
        ? item.requires_shipping
        : Boolean(variant.requires_shipping),
    is_discountable:
      typeof item.is_discountable === "boolean"
        ? item.is_discountable
        : Boolean(
            variant.is_discountable ?? product.discountable ?? true
          ),
    is_tax_inclusive: Boolean(item.is_tax_inclusive),
    compare_at_unit_price: item.compare_at_unit_price ?? null,
    unit_price: item.unit_price,
    tax_lines: toArray(item.tax_lines).map((taxLine) => {
      const record = toRecord(taxLine)
      return {
        description: record.description,
        tax_rate_id: record.tax_rate_id,
        code: record.code,
        rate: record.rate,
        provider_id: record.provider_id,
      }
    }),
    adjustments: toArray(item.adjustments).map((adjustment) => {
      const record = toRecord(adjustment)
      return {
        code: record.code,
        amount: record.amount,
        description: record.description,
        promotion_id: record.promotion_id,
        provider_id: record.provider_id,
        is_tax_inclusive: record.is_tax_inclusive,
      }
    }),
    metadata: toRecord(item.metadata),
  } as unknown as NonNullable<CreateOrderDTO["items"]>[number]
}

function sanitizeAddress(address: GenericRecord | null | undefined) {
  if (!address) {
    return undefined
  }

  const nextAddress = { ...address }
  delete nextAddress.id
  delete nextAddress.created_at
  delete nextAddress.updated_at
  delete nextAddress.deleted_at

  return nextAddress
}

function sumItemAmount(
  total: number,
  item: NonNullable<CreateOrderDTO["items"]>[number]
) {
  return total + Number(item.unit_price || 0) * Number(item.quantity || 0)
}

function toArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function toRecord(value: unknown): GenericRecord {
  return value && typeof value === "object" ? (value as GenericRecord) : {}
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value ? value : undefined
}
