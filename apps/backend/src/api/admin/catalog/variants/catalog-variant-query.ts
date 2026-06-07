import type { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { resolveProductFulfillmentPolicy } from "../../../../platform/delivery"
import {
  getInventoryHandler,
  type InventoryAvailability,
} from "../../../../platform/inventory"
import {
  getLocalizedProductTemplate,
  resolveProductTemplate,
} from "../../../../platform/product-templates"
import { createInventoryHandlerScope } from "../../../../platform-adapters/backend-context"

const DEFAULT_LIMIT = 200
const MAX_LIMIT = 250

type QueryGraph = {
  graph: (input: {
    entity: string
    fields: string[]
    filters?: Record<string, unknown>
    pagination?: {
      take?: number
      skip?: number
      order?: Record<string, "ASC" | "DESC">
    }
  }) => Promise<{ data?: Array<Record<string, unknown>> }>
}

type CatalogVariant = {
  id: string
  title: string | null
  sku: string | null
  product_id: string | null
  product_title: string | null
  product_handle: string | null
  product_type: string | null
  template_code: string
  template_title: string
  inventory_handler_code: string
  delivery_handler_code: string | null
  credential_inventory_supported: boolean
  availability_supported: boolean
  total_count: number | null
  available_count: number | null
  reserved_count: number | null
  sold_count: number | null
  locked_count: number | null
  is_in_stock: boolean | null
}

export async function listAdminCatalogVariants(input: {
  scope: MedusaRequest["scope"]
  queryParams: Record<string, unknown>
  locale: string | null
}) {
  const limit = toBoundedNumber(input.queryParams.limit, DEFAULT_LIMIT, MAX_LIMIT)
  const offset = toBoundedNumber(input.queryParams.offset, 0, 10_000)
  const search = toOptionalString(input.queryParams.q).toLowerCase()
  const query = input.scope.resolve(ContainerRegistrationKeys.QUERY) as QueryGraph

  const result = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "title",
      "sku",
      "metadata",
      "product.id",
      "product.title",
      "product.handle",
      "product.type.value",
      "product.metadata",
    ],
    pagination: {
      take: limit,
      skip: offset,
      order: {
        updated_at: "DESC",
      },
    },
  })

  const rows = (result.data || []).filter((row) => matchesSearch(row, search))
  const variants = await Promise.all(
    rows.map((row) => toCatalogVariant(input.scope, row, input.locale))
  )
  const availabilityByVariantId = await listAvailability(input.scope, variants)

  return variants
    .map((variant) => withAvailability(variant, availabilityByVariantId))
    .sort(sortVariantCatalog)
}

async function toCatalogVariant(
  scope: MedusaRequest["scope"],
  row: Record<string, unknown>,
  locale: string | null
): Promise<CatalogVariant> {
  const variantId = toOptionalString(row.id)

  if (!variantId) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Product variant query returned a row without id"
    )
  }

  const variantMetadata = normalizeRecord(row.metadata)
  const product = normalizeRecord(row.product)
  const productMetadata = normalizeRecord(product.metadata)
  const metadata = {
    ...productMetadata,
    ...variantMetadata,
  }
  const productType =
    toOptionalString(normalizeRecord(product.type).value) ||
    toOptionalString(metadata.product_type) ||
    toOptionalString(metadata.productType) ||
    null
  const template = resolveProductTemplate({
    productType,
    metadata,
  })

  if (!template) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Product variant ${variantId} references an unknown product template`
    )
  }

  const localizedTemplate =
    getLocalizedProductTemplate(template.code, locale) || template
  const plan = await resolveProductFulfillmentPolicy({
    code:
      toOptionalString(metadata.fulfillment_policy_code) ||
      toOptionalString(metadata.fulfillmentPolicyCode) ||
      template.fulfillmentPolicyCode,
    productVariantId: variantId,
    productType: productType || template.productType || null,
    metadata: {
      template_code: template.code,
      product_type: template.productType || productType || null,
      product_variant_id: variantId,
      ...metadata,
    },
  })
  const inventoryHandlerCode =
    toOptionalString(metadata.inventory_handler_code) ||
    toOptionalString(metadata.inventoryHandlerCode) ||
    (plan?.inventoryMode === "none" ? "noop" : "") ||
    template.inventoryHandlerCode ||
    plan?.inventoryHandlerCode

  if (!inventoryHandlerCode) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `No inventory handler configured for product variant ${variantId}`
    )
  }

  if (inventoryHandlerCode !== "noop" && !getInventoryHandler(inventoryHandlerCode)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Inventory handler ${inventoryHandlerCode} is not registered`
    )
  }

  return {
    id: variantId,
    title: toNullableString(row.title),
    sku: toNullableString(row.sku),
    product_id: toNullableString(product.id),
    product_title: toNullableString(product.title),
    product_handle: toNullableString(product.handle),
    product_type: productType || template.productType || null,
    template_code: template.code,
    template_title: localizedTemplate.title,
    inventory_handler_code: inventoryHandlerCode,
    delivery_handler_code:
      toOptionalString(metadata.delivery_handler_code) ||
      toOptionalString(metadata.deliveryHandlerCode) ||
      template.deliveryHandlerCode ||
      plan?.deliveryHandlerCode ||
      null,
    credential_inventory_supported: inventoryHandlerCode === "credential-inventory",
    availability_supported: Boolean(
      inventoryHandlerCode !== "noop" &&
        getInventoryHandler(inventoryHandlerCode)?.listAvailability
    ),
    total_count: null,
    available_count: null,
    reserved_count: null,
    sold_count: null,
    locked_count: null,
    is_in_stock: null,
  }
}

async function listAvailability(
  scope: MedusaRequest["scope"],
  variants: CatalogVariant[]
) {
  const scopeForHandler = createInventoryHandlerScope(scope)
  const byHandlerCode = new Map<string, string[]>()
  const availabilityByVariantId = new Map<string, InventoryAvailability>()

  for (const variant of variants) {
    if (!variant.availability_supported) {
      continue
    }

    byHandlerCode.set(variant.inventory_handler_code, [
      ...(byHandlerCode.get(variant.inventory_handler_code) || []),
      variant.id,
    ])
  }

  await Promise.all(
    Array.from(byHandlerCode.entries()).map(async ([handlerCode, variantIds]) => {
      const handler = getInventoryHandler(handlerCode)

      if (!handler?.listAvailability) {
        return
      }

      const availability = await handler.listAvailability({
        scope: scopeForHandler,
        variantIds,
      })

      for (const item of availability) {
        availabilityByVariantId.set(item.variant_id, item)
      }
    })
  )

  return availabilityByVariantId
}

function withAvailability(
  variant: CatalogVariant,
  availabilityByVariantId: Map<string, InventoryAvailability>
): CatalogVariant {
  const availability = availabilityByVariantId.get(variant.id)

  if (!availability) {
    return variant
  }

  return {
    ...variant,
    total_count: availability.total_count,
    available_count: availability.available_count,
    reserved_count: availability.reserved_count,
    sold_count: availability.sold_count,
    locked_count: availability.locked_count,
    is_in_stock: availability.is_in_stock,
  }
}

function matchesSearch(row: Record<string, unknown>, search: string) {
  if (!search) {
    return true
  }

  const product = normalizeRecord(row.product)
  const haystack = [
    row.id,
    row.title,
    row.sku,
    product.id,
    product.title,
    product.handle,
  ]
    .map((value) => toOptionalString(value).toLowerCase())
    .join(" ")

  return haystack.includes(search)
}

function sortVariantCatalog(left: CatalogVariant, right: CatalogVariant) {
  return (
    (left.product_title || "").localeCompare(right.product_title || "") ||
    (left.title || "").localeCompare(right.title || "") ||
    left.id.localeCompare(right.id)
  )
}

function toBoundedNumber(value: unknown, fallback: number, max: number) {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = Number(raw)

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback
  }

  return Math.min(Math.floor(parsed), max)
}

function normalizeRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function toNullableString(value: unknown) {
  const normalized = toOptionalString(value)

  return normalized || null
}

function toOptionalString(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value

  return typeof raw === "string" && raw.trim() ? raw.trim() : ""
}
