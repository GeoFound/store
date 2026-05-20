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
import { listProducts } from "@/lib/medusa"
import { getSiteConfig, type SiteCategoryLinkConfig } from "@/lib/site-config"
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
  const products = await safeListProducts()
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
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold">{catalogContent.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 opacity-70">
            {catalogContent.description}
          </p>
        </div>
        {categoryFilters.length ? (
          <div className="mb-6 flex flex-wrap gap-2">
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
        <div className="theme-border mb-6 flex flex-wrap items-center gap-2 border-b pb-4 text-sm">
          <span className="font-medium opacity-70">{catalogContent.sortLabel}</span>
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
      </main>
    </>
  )
}

async function safeListProducts() {
  try {
    return await listProducts()
  } catch {
    return []
  }
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
          ? "theme-primary-action px-3 py-2 text-sm font-semibold"
          : "theme-secondary-action px-3 py-2 text-sm font-semibold"
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
