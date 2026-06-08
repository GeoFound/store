import Link from "next/link"
import { ProductGrid } from "@/components/product-grid"
import { SiteHeader } from "@/components/site-header"
import { ensureStorefrontExtensionsRegistered } from "@/extensions/defaults"
import { renderStorefrontExtensions } from "@/extensions/registry"
import {
  buildProductsHref,
  filterProductsByCategory,
  listProductCategories,
  normalizeCatalogSort,
  sortProducts,
} from "@/lib/catalog"
import { listProducts } from "@/lib/commerce"
import { getSiteConfig, type SiteCategoryLinkConfig } from "@/lib/site-config"
import { applyProductDisplayConfig } from "@/lib/site-products"
import type { ProductCategory } from "@/lib/types"

export const dynamic = "force-dynamic"

type ProductsPageProps = {
  searchParams?: Promise<{
    category?: string
    sort?: string
  }>
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  ensureStorefrontExtensionsRegistered()
  const siteConfig = getSiteConfig()
  const params = await searchParams
  const rawProducts = await listProducts()
  const products = applyProductDisplayConfig(
    rawProducts,
    siteConfig.content.catalog.productDisplay
  )
  const activeCategory = params?.category || ""
  const activeSort = normalizeCatalogSort(params?.sort)
  const categories = listProductCategories(products)
  const categoryFilters = resolveCategoryFilters(
    categories,
    siteConfig.content.categories.links
  )
  const filteredProducts = sortProducts(
    filterProductsByCategory(products, activeCategory),
    activeSort
  )
  const catalogContent = siteConfig.content.catalog

  return (
    <>
      <SiteHeader />
      <main className="theme-subtle-grid flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
          <section className="theme-surface theme-border mb-6 rounded-[var(--radius)] border p-6 shadow-[var(--shadow-card)] sm:p-8">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div>
                <h1 className="text-4xl font-semibold leading-tight">
                  {catalogContent.title}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 opacity-70">
                  {catalogContent.description}
                </p>
              </div>
              <div className="text-sm font-medium opacity-70">
                {filteredProducts.length} product
                {filteredProducts.length === 1 ? "" : "s"}
              </div>
            </div>
          </section>
          {categoryFilters.length ? (
            <div className="mb-4 flex flex-wrap gap-2">
              <FilterLink
                href={buildProductsHref({ sort: activeSort })}
                active={!activeCategory}
              >
                {catalogContent.allProductsLabel}
              </FilterLink>
              {categoryFilters.map((category) => (
                <FilterLink
                  key={category.key}
                  href={buildProductsHref({
                    category: category.key,
                    sort: activeSort,
                  })}
                  active={activeCategory === category.key}
                >
                  {category.label}
                </FilterLink>
              ))}
            </div>
          ) : null}
          <div className="theme-border mb-6 flex flex-wrap items-center gap-2 border-b pb-5 text-sm">
            <span className="mr-1 font-medium opacity-70">
              {catalogContent.sortLabel}
            </span>
            <FilterLink
              href={buildProductsHref({ category: activeCategory })}
              active={activeSort === "default"}
            >
              {catalogContent.sortDefaultLabel}
            </FilterLink>
            <FilterLink
              href={buildProductsHref({
                category: activeCategory,
                sort: "price-asc",
              })}
              active={activeSort === "price-asc"}
            >
              {catalogContent.sortPriceAscLabel}
            </FilterLink>
            <FilterLink
              href={buildProductsHref({
                category: activeCategory,
                sort: "price-desc",
              })}
              active={activeSort === "price-desc"}
            >
              {catalogContent.sortPriceDescLabel}
            </FilterLink>
            <FilterLink
              href={buildProductsHref({
                category: activeCategory,
                sort: "newest",
              })}
              active={activeSort === "newest"}
            >
              {catalogContent.sortNewestLabel}
            </FilterLink>
          </div>
          <div className="mb-6 grid gap-4">
            {renderStorefrontExtensions("products.header.after", {}).map((entry) => (
              <div key={entry.key}>{entry.node}</div>
            ))}
          </div>
          <ProductGrid products={filteredProducts} />
        </div>
      </main>
    </>
  )
}

function FilterLink(props: {
  href: string
  active?: boolean
  children: string
}) {
  return (
    <Link
      href={props.href}
      className={
        props.active
          ? "theme-primary-action inline-flex min-h-10 items-center px-3.5 text-sm font-semibold"
          : "theme-secondary-action inline-flex min-h-10 items-center px-3.5 text-sm font-semibold"
      }
    >
      {props.children}
    </Link>
  )
}

function resolveCategoryFilters(
  categories: ProductCategory[],
  configuredLinks: SiteCategoryLinkConfig[]
) {
  const filters = new Map<string, string>()

  for (const link of configuredLinks) {
    const category = extractCategoryFromHref(link.href)

    if (category) {
      filters.set(category, link.label)
    }
  }

  for (const category of categories) {
    const key = category.handle || category.id

    if (key && !filters.has(key)) {
      filters.set(key, category.name)
    }
  }

  return Array.from(filters.entries()).map(([key, label]) => ({
    key,
    label,
  }))
}

function extractCategoryFromHref(href: string) {
  try {
    const url = new URL(href, "https://store.local")
    return url.searchParams.get("category") || ""
  } catch {
    return ""
  }
}
