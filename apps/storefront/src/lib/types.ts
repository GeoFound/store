export type MoneyAmount = {
  amount?: number
  currency_code?: string
  calculated_amount?: number
  calculated_amount_with_tax?: number
}

export type ProductVariant = {
  id: string
  title: string
  sku?: string | null
  inventory_quantity?: number
  available_quantity?: number
  reserved_quantity?: number
  sold_quantity?: number
  is_in_stock?: boolean
  calculated_price?: MoneyAmount
}

export type ProductCategory = {
  id: string
  name: string
  handle: string
}

export type ProductTemplate = {
  code: string
  title: string
  description: string
  productType: string
  fulfillmentPolicyCode: string
  deliveryHandlerCode: string
  inventoryHandlerCode?: string
  deliveryLabel: string
}

export type Product = {
  id: string
  title: string
  handle: string
  description?: string | null
  thumbnail?: string | null
  status?: string
  metadata?: Record<string, unknown> | null
  type?: {
    id?: string
    value?: string | null
  } | null
  template?: ProductTemplate
  isSoldOut?: boolean
  variants?: ProductVariant[]
  categories?: ProductCategory[]
}

export type Region = {
  id: string
  name: string
  currency_code: string
}

export type CartLineItem = {
  id: string
  title: string
  quantity: number
  unit_price: number
  total?: number
  thumbnail?: string | null
  product_title?: string
  variant_id?: string
}

export type Cart = {
  id: string
  email?: string | null
  region_id?: string
  currency_code?: string
  total?: number
  subtotal?: number
  items?: CartLineItem[]
}

export type PaymentMethod = {
  id: string
  code: string
  display_name: string
  type: string
  priority: number
  health_status: "healthy" | "degraded" | "down"
}

export type PaymentAttempt = {
  id: string
  cart_id: string
  order_id?: string | null
  provider_order_id: string
  amount: number
  currency: string
  status: "pending" | "paid" | "failed" | "expired" | "partial" | "refunded"
  provider_code: string
  paid_at?: string | null
  order_access_claimed_at?: string | null
  order_access_claim_token_hint?: string | null
}

export type ManualPaymentInstructions = {
  title: string
  body: string
  reference: string
}

export type DeliveryRecord = {
  id: string
  order_id?: string | null
  cart_id?: string | null
  payment_attempt_id?: string | null
  account_item_id?: string | null
  delivery_status: "pending" | "delivered" | "confirmed" | "replaced" | "refunded"
  access_token_hint?: string
  delivered_at?: string | null
  buyer_confirmed_at?: string | null
  delivery_note?: string | null
}

export type DeliveryLookupResult = {
  delivery: DeliveryRecord
  payload: Record<string, unknown> | string
}

export type OrderDeliveryLookupResult = {
  delivery: DeliveryRecord
  payload: Record<string, unknown> | string
}

export type OrderSummary = {
  id: string
  display_id?: number | null
  custom_display_id?: string | null
  status: string
  email?: string | null
  currency_code: string
  total?: number
  subtotal?: number
  created_at?: string
  updated_at?: string
  items?: CartLineItem[]
}

export type OrderLookupResult = {
  order: OrderSummary
  deliveries: OrderDeliveryLookupResult[]
}

export type AfterSale = {
  id: string
  delivery_id: string
  customer_email?: string | null
  reason: "not_working" | "wrong_item" | "duplicate" | "refund" | "other"
  message: string
  status: "open" | "processing" | "resolved" | "rejected" | "closed"
  result: "pending" | "replaced" | "refunded" | "rejected" | "resolved"
  admin_note?: string | null
  created_at?: string
}
