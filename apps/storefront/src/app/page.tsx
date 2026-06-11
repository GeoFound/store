import { SiteHeader } from "@/components/site-header"
import { ensureStorefrontExtensionsRegistered } from "@/extensions/defaults"
import { buildProductsHref, listProductCategories } from "@/lib/catalog"
import { listProducts } from "@/lib/commerce"
import { listContentEntries } from "@/lib/content"
import { getSiteConfig, type SiteCategoryLinkConfig } from "@/lib/site-config"
import { applyProductDisplayConfig } from "@/lib/site-products"
import type { Product } from "@/lib/types"
import { HomeSections } from "@/sections/home"

export const dynamic = "force-dynamic"

export default async function Home() {
  ensureStorefrontExtensionsRegistered()
  const siteConfig = getSiteConfig()
  const homeContent = siteConfig.content.home
  const [rawProducts, insights] = await Promise.all([
    listProducts(),
    listContentEntries({ limit: 3 }),
  ])
  const products = applyProductDisplayConfig(
    rawProducts,
    siteConfig.content.catalog.productDisplay
  )
  const featured = products.slice(0, homeContent.featuredLimit)
  const categoryLinks = resolveHomeCategoryLinks(
    products,
    siteConfig.content.categories.links
  )

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <HomeSections
          siteConfig={siteConfig}
          featuredProducts={featured}
          categoryLinks={categoryLinks}
          insights={insights}
        />
      </main>
    </>
  )
}

function resolveHomeCategoryLinks(
  products: Product[],
  configuredLinks: SiteCategoryLinkConfig[]
): SiteCategoryLinkConfig[] {
  if (configuredLinks.length) {
    return configuredLinks
  }

  return listProductCategories(products)
    .slice(0, 6)
    .map((category) => ({
      label: category.name,
      href: buildProductsHref({
        category: category.handle || category.id,
      }),
      description: undefined,
    }))
}
