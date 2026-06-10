import Link from "next/link"
import type { CSSProperties } from "react"
import { ProductGrid } from "@/components/product-grid"
import { SiteHeader } from "@/components/site-header"
import { ensureStorefrontExtensionsRegistered } from "@/extensions/defaults"
import { renderStorefrontExtensions } from "@/extensions/registry"
import { buildProductsHref, listProductCategories } from "@/lib/catalog"
import { listProducts } from "@/lib/commerce"
import { listContentEntries } from "@/lib/content"
import { getSiteConfig, type SiteCategoryLinkConfig } from "@/lib/site-config"
import { applyProductDisplayConfig } from "@/lib/site-products"
import type { Product } from "@/lib/types"

export const dynamic = "force-dynamic"

const heroWordStates = [
  { label: "Browsing", word: "Browse" },
  { label: "Checkout", word: "Order" },
  { label: "Delivery", word: "Access" },
  { label: "Recovery", word: "Claim" },
]
const heroWordSizer = heroWordStates.reduce((longest, state) =>
  state.word.length > longest.word.length ? state : longest
).word

export default async function Home() {
  ensureStorefrontExtensionsRegistered()
  const siteConfig = getSiteConfig()
  const homeContent = siteConfig.content.home
  const heroName = withTerminalPeriod(siteConfig.site.name)
  const heroWordStyle = {
    "--store-copy-hero-word-scale": getHeroWordScale(heroWordSizer),
  } as CSSProperties
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
        <section className="theme-surface theme-border store-copy-hero border-b">
          <div className="store-copy-hero-inner mx-auto flex flex-col items-center px-4 text-center sm:px-6">
            <h1
              className="store-copy-hero-title"
              aria-label={`${heroName} Browse effortlessly.`}
            >
              <span className="store-copy-hero-line store-copy-hero-line-top">
                {heroName}
              </span>
              <span className="store-copy-hero-line store-copy-hero-line-bottom">
                <span
                  className="store-copy-hero-rotator"
                  aria-hidden="true"
                  style={heroWordStyle}
                >
                  <span className="store-copy-hero-rotator-sizer">
                    {heroWordSizer}
                  </span>
                  {heroWordStates.map((state) => (
                    <span key={state.word} className="store-copy-hero-state">
                      <span className="store-copy-hero-tag">
                        <svg
                          aria-hidden="true"
                          className="store-copy-hero-tag-icon"
                          viewBox="0 0 24 24"
                        >
                          <path d="M9 18 3 12l6-6M15 6l6 6-6 6" />
                        </svg>
                        {state.label}
                      </span>
                      <span className="store-copy-hero-word">{state.word}</span>
                    </span>
                  ))}
                </span>
                <span className="store-copy-hero-static">effortlessly.</span>
              </span>
            </h1>
            <p className="store-copy-hero-description">
              {homeContent.description}
            </p>
            <div className="store-copy-hero-actions">
              <Link
                href="/products"
                className="store-copy-hero-primary-action"
              >
                <span>Browse products</span>
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M5 12h13M13 6l6 6-6 6" />
                </svg>
              </Link>
              <Link
                href="/orders"
                className="store-copy-hero-secondary-action"
              >
                <span>Find order</span>
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M5 12h13M13 6l6 6-6 6" />
                </svg>
              </Link>
            </div>
          </div>
          <div className="mx-auto grid max-w-7xl gap-4 px-4 pb-10 sm:px-6">
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

        <section className="mx-auto max-w-7xl px-4 pb-10 pt-2 sm:px-6">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold">
                {homeContent.insightsHeading}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 opacity-70">
                {homeContent.insightsDescription}
              </p>
            </div>
            <Link
              href="/insights"
              className="theme-secondary-action hidden px-4 py-2 text-sm font-semibold sm:inline-flex"
            >
              {homeContent.insightsCta}
            </Link>
          </div>
          {insights.length ? (
            <div className="grid gap-4 md:grid-cols-3">
              {insights.map((entry) => (
                <Link
                  key={entry.id}
                  href={`/insights/${entry.slug}`}
                  className="theme-card group block p-5"
                >
                  <div className="text-xs font-semibold uppercase opacity-60">
                    {entry.topic || entry.content_type.replace(/_/g, " ")}
                  </div>
                  <h3 className="mt-3 text-xl font-semibold leading-tight">
                    {entry.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 opacity-70">
                    {entry.excerpt || entry.body}
                  </p>
                  <div className="theme-accent-text mt-5 text-sm font-semibold">
                    {siteConfig.content.insights.readMoreLabel}
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
        </section>

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

function withTerminalPeriod(value: string) {
  const trimmed = value.trim()

  return /[.!?。！？]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

function getHeroWordScale(value: string) {
  const length = Array.from(value.trim()).length || 1

  return length <= 6 ? "1" : Math.max(0.7, 6 / length).toFixed(3)
}
