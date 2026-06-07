import Link from "next/link"
import Image from "next/image"
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
  const products = await listProducts()
  const featured = products.slice(0, homeContent.featuredLimit)
  const categoryLinks = resolveHomeCategoryLinks(
    products,
    siteConfig.content.categories.links
  )

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="theme-surface theme-border atlas-hero-grid border-b">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:min-h-[640px] lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:py-12">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-semibold leading-[1.04] tracking-normal sm:text-6xl">
                {homeContent.headline}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 opacity-75 sm:text-lg">
                {homeContent.description}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/products"
                  className="theme-primary-action inline-flex min-h-12 items-center justify-center px-5 text-sm font-semibold"
                >
                  {homeContent.browseCta}
                </Link>
                <Link
                  href="/orders"
                  className="theme-secondary-action inline-flex min-h-12 items-center justify-center px-5 text-sm font-semibold"
                >
                  {homeContent.ordersCta}
                </Link>
              </div>
              <div className="mt-8 hidden max-w-2xl gap-3 text-sm sm:grid sm:grid-cols-3">
                <div className="theme-field-row px-4 py-3">
                  <div className="font-semibold">Guest checkout</div>
                  <p className="mt-1 leading-5 opacity-70">Buy without accounts.</p>
                </div>
                <div className="theme-field-row px-4 py-3">
                  <div className="font-semibold">Order access</div>
                  <p className="mt-1 leading-5 opacity-70">Recover delivery later.</p>
                </div>
                <div className="theme-field-row px-4 py-3">
                  <div className="font-semibold">Digital delivery</div>
                  <p className="mt-1 leading-5 opacity-70">Fulfilled after payment.</p>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="atlas-dots absolute right-8 top-4 hidden h-28 w-28 opacity-60 md:block" />
              <div className="atlas-dots-amber absolute bottom-8 left-8 hidden h-16 w-20 opacity-80 md:block" />
              <div className="theme-panel relative aspect-[16/8] overflow-hidden border-0 bg-white shadow-[var(--shadow-soft)] md:aspect-[16/9] lg:aspect-[16/10]">
                <Image
                  src="/atlas-delivery-hero.png"
                  alt="Laptop and phone showing abstract digital order delivery screens"
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  priority
                  className="object-cover"
                />
              </div>
            </div>
          </div>
          <div className="mx-auto grid max-w-7xl gap-4 px-4 pb-10 sm:px-6 lg:grid-cols-1">
            {homeContent.announcements.map((announcement) => (
              <div
                key={`${announcement.title}:${announcement.body}`}
                className={`theme-panel p-4 text-sm shadow-none ${
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
          <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
            <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-2xl font-semibold">
                  {siteConfig.content.categories.heading}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 opacity-70">
                  {siteConfig.content.categories.description}
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categoryLinks.map((category) => (
                <Link
                  key={category.href}
                  href={category.href}
                  className="theme-card group block p-5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-semibold">{category.label}</div>
                    <span className="theme-accent-text transition-transform group-hover:translate-x-1">
                      <svg
                        aria-hidden="true"
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M5 12h14M13 6l6 6-6 6"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </div>
                  {category.description ? (
                    <p className="mt-3 text-sm leading-6 opacity-70">
                      {category.description}
                    </p>
                  ) : null}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mx-auto max-w-7xl px-4 pb-14 pt-4 sm:px-6">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold">
                {homeContent.productsHeading}
              </h2>
              <p className="mt-2 text-sm opacity-70">
                {homeContent.productsDescription}
              </p>
            </div>
            <Link
              href="/products"
              className="theme-secondary-action hidden px-4 py-2 text-sm font-semibold sm:inline-flex"
            >
              View all products
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
