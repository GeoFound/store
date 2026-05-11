import { MedusaError } from "@medusajs/framework/utils"
import type { CreateOrderDTO } from "@medusajs/framework/types"

type GenericRecord = Record<string, any>

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
  cart: GenericRecord
  customerId?: string | null
  transactionReferenceId?: string
}) {
  const cart = input.cart

  if (!cart.email) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Cart email is required before order creation"
    )
  }

  const items = (cart.items || []).map((item: GenericRecord) =>
    buildOrderItem(item)
  )

  if (!items.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Cart must contain at least one item"
    )
  }

  return {
    region_id: cart.region_id,
    customer_id: input.customerId || cart.customer?.id || undefined,
    sales_channel_id: cart.sales_channel_id,
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
              amount: cart.total ?? items.reduce(sumItemAmount, 0),
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
  const variant = item.variant || {}
  const product = variant.product || {}

  return {
    quantity: item.quantity,
    title: item.title || product.title,
    subtitle: item.subtitle || variant.title,
    thumbnail: item.thumbnail || variant.thumbnail || product.thumbnail,
    product_id: product.id || item.product_id,
    product_title: item.product_title || product.title,
    product_description: item.product_description || product.description,
    product_subtitle: item.product_subtitle || product.subtitle,
    product_type: item.product_type || product.type?.value || null,
    product_type_id: item.product_type_id || product.type?.id || null,
    product_collection:
      item.product_collection || product.collection?.title || null,
    product_handle: item.product_handle || product.handle,
    variant_id: item.variant_id || variant.id,
    variant_sku: item.variant_sku || variant.sku,
    variant_barcode: item.variant_barcode || variant.barcode,
    variant_title: item.variant_title || variant.title,
    variant_option_values: item.variant_option_values || {},
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
    tax_lines: (item.tax_lines || []).map((taxLine: GenericRecord) => ({
      description: taxLine.description,
      tax_rate_id: taxLine.tax_rate_id,
      code: taxLine.code,
      rate: taxLine.rate,
      provider_id: taxLine.provider_id,
    })),
    adjustments: (item.adjustments || []).map((adjustment: GenericRecord) => ({
      code: adjustment.code,
      amount: adjustment.amount,
      description: adjustment.description,
      promotion_id: adjustment.promotion_id,
      provider_id: adjustment.provider_id,
      is_tax_inclusive: adjustment.is_tax_inclusive,
    })),
    metadata: item.metadata || {},
  }
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

function sumItemAmount(total: number, item: GenericRecord) {
  return total + Number(item.unit_price || 0) * Number(item.quantity || 0)
}
