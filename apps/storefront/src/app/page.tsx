import Link from "next/link"
import { ProductGrid } from "@/components/product-grid"
import { SiteHeader } from "@/components/site-header"
import { ensureStorefrontExtensionsRegistered } from "@/extensions/defaults"
import { renderStorefrontExtensions } from "@/extensions/registry"
import { buildProductsHref, listProductCategories } from "@/lib/catalog"
import { listProducts } from "@/lib/commerce"
import { getSiteConfig, type SiteCategoryLinkConfig } from "@/lib/site-config"
import type { Product } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function Home() {
  ensureStorefrontExtensionsRegistered()
  const siteConfig = getSiteConfig()
  const homeContent = siteConfig.content.home
  const products = await safeListProducts()
  const featured = products.slice(0, homeContent.featuredLimit)
  const categoryLinks = resolveHomeCategoryLinks(
    products,
    siteConfig.content.categories.links
  )

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="theme-surface theme-border border-b">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-normal sm:text-5xl">
                {homeContent.headline}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 opacity-75">
                {homeContent.description}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/products"
                  className="theme-primary-action px-4 py-3 text-sm font-semibold"
                >
                  {homeContent.browseCta}
                </Link>
                <Link
                  href="/orders"
                  className="theme-secondary-action px-4 py-3 text-sm font-semibold"
                >
                  {homeContent.ordersCta}
                </Link>
              </div>
            </div>
            <div className="theme-panel theme-muted-surface overflow-hidden">
              <div
                className="aspect-[4/3]"
                style={{
                  backgroundImage: homeContent.heroPattern,
                }}
              />
            </div>
          </div>
          <div className="mx-auto grid max-w-6xl gap-4 px-4 pb-10 sm:px-6 lg:grid-cols-1">
            {homeContent.announcements.map((announcement) => (
              <div
                key={`${announcement.title}:${announcement.body}`}
                className={`theme-panel p-4 text-sm ${
                  announcement.tone === "success"
                    ? "theme-status-success"
                    : announcement.tone === "warning"
                      ? "theme-status-warning"
                      : ""
                }`}
              >
                <div className="font-semibold">{announcement.title}</div>
                <p className="mt-1 leading-6 opacity-75">{announcement.body}</p>
              </div>
            ))}
            {renderStorefrontExtensions("home.hero.after", {}).map((entry) => (
              <div key={entry.key}>{entry.node}</div>
            ))}
          </div>
        </section>

        {categoryLinks.length ? (
          <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
            <div className="mb-5">
              <h2 className="text-2xl font-semibold">
                {siteConfig.content.categories.heading}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 opacity-70">
                {siteConfig.content.categories.description}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categoryLinks.map((category) => (
                <Link
                  key={category.href}
                  href={category.href}
                  className="theme-card block p-4"
                >
                  <div className="font-semibold">{category.label}</div>
                  {category.description ? (
                    <p className="mt-2 text-sm leading-6 opacity-70">
                      {category.description}
                    </p>
                  ) : null}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">
                {homeContent.productsHeading}
              </h2>
              <p className="mt-1 text-sm opacity-70">
                {homeContent.productsDescription}
              </p>
            </div>
            <Link href="/products" className="text-sm font-semibold theme-accent-text">
              View all
            </Link>
          </div>
          <ProductGrid products={featured} />
          <div className="mt-6 grid gap-4">
            {renderStorefrontExtensions("home.products.after", {}).map((entry) => (
              <div key={entry.key}>{entry.node}</div>
            ))}
          </div>
        </section>
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
