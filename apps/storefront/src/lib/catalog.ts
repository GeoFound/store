import { getVariantPrice } from "./format"
import type { Product, ProductCategory } from "./types"

export type CatalogSort = "default" | "price-asc" | "price-desc" | "newest"

export function normalizeCatalogSort(value?: string | null): CatalogSort {
  if (
    value === "price-asc" ||
    value === "price-desc" ||
    value === "newest"
  ) {
    return value
  }

  return "default"
}

export function listProductCategories(products: Product[]) {
  const categories = new Map<string, ProductCategory>()

  for (const product of products) {
    for (const category of product.categories || []) {
      const key = getCategoryKey(category)

      if (!key || categories.has(key)) {
        continue
      }

      categories.set(key, category)
    }
  }

  return Array.from(categories.values()).sort((left, right) =>
    left.name.localeCompare(right.name)
  )
}

export function filterProductsByCategory(
  products: Product[],
  categoryHandle?: string | null
) {
  const normalizedCategory = normalizeCategoryHandle(categoryHandle)

  if (!normalizedCategory) {
    return products
  }

  return products.filter((product) =>
    (product.categories || []).some(
      (category) => getCategoryKey(category) === normalizedCategory
    )
  )
}

export function sortProducts(products: Product[], sort: CatalogSort) {
  const sorted = [...products]

  if (sort === "price-asc") {
    sorted.sort((left, right) => getLowestPrice(left) - getLowestPrice(right))
  }

  if (sort === "price-desc") {
    sorted.sort((left, right) => getLowestPrice(right) - getLowestPrice(left))
  }

  if (sort === "newest") {
    sorted.sort(
      (left, right) => getProductTimestamp(right) - getProductTimestamp(left)
    )
  }

  return sorted
}

export function buildProductsHref(input: {
  category?: string | null
  sort?: CatalogSort | null
}) {
  const params = new URLSearchParams()
  const category = normalizeCategoryHandle(input.category)
  const sort = normalizeCatalogSort(input.sort)

  if (category) {
    params.set("category", category)
  }

  if (sort !== "default") {
    params.set("sort", sort)
  }

  const query = params.toString()
  return `/products${query ? `?${query}` : ""}`
}

export function getCategoryKey(category?: ProductCategory | null) {
  return normalizeCategoryHandle(category?.handle || category?.id || "")
}

function normalizeCategoryHandle(value?: string | null) {
  return String(value || "").trim()
}

function getLowestPrice(product: Product) {
  const prices = (product.variants || [])
    .map((variant) => getVariantPrice(variant).amount)
    .filter((amount): amount is number => typeof amount === "number")

  return prices.length ? Math.min(...prices) : Number.POSITIVE_INFINITY
}

function getProductTimestamp(product: Product) {
  const date = product.created_at || product.updated_at

  if (!date) {
    return 0
  }

  const timestamp = Date.parse(date)
  return Number.isNaN(timestamp) ? 0 : timestamp
}
