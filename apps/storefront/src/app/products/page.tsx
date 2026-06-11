import { SiteHeader } from "@/components/site-header"
import { ensureStorefrontExtensionsRegistered } from "@/extensions/defaults"
import {
  filterProductsByCategory,
  listProductCategories,
  normalizeCatalogSort,
  sortProducts,
} from "@/lib/catalog"
import { listProducts } from "@/lib/commerce"
import { getSiteConfig } from "@/lib/site-config"
import { applyProductDisplayConfig } from "@/lib/site-products"
import { ProductsSections, resolveCategoryFilters } from "@/sections/products"

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
  const rawProducts = await listProducts().catch(() => [])
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

  return (
    <>
      <SiteHeader />
      <main className="theme-subtle-grid flex-1">
        <ProductsSections
          siteConfig={siteConfig}
          products={filteredProducts}
          categoryFilters={categoryFilters}
          activeCategory={activeCategory}
          activeSort={activeSort}
        />
      </main>
    </>
  )
}
