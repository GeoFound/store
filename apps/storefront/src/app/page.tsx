import Link from "next/link"
import { ProductGrid } from "@/components/product-grid"
import { SiteHeader } from "@/components/site-header"
import { ensureStorefrontExtensionsRegistered } from "@/extensions/defaults"
import { renderStorefrontExtensions } from "@/extensions/registry"
import { listProducts } from "@/lib/medusa"
import { getSiteConfig } from "@/lib/site-config"

export const dynamic = "force-dynamic"

export default async function Home() {
  ensureStorefrontExtensionsRegistered()
  const siteConfig = getSiteConfig()
  const homeContent = siteConfig.content.home
  const products = await safeListProducts()
  const featured = products.slice(0, 6)

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-stone-200 bg-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-stone-950 sm:text-5xl">
                {homeContent.headline}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-stone-700">
                {homeContent.description}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/products"
                  className="bg-stone-950 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-800"
                >
                  {homeContent.browseCta}
                </Link>
                <Link
                  href="/orders"
                  className="border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-950 hover:border-stone-950"
                >
                  {homeContent.ordersCta}
                </Link>
              </div>
            </div>
            <div className="overflow-hidden border border-stone-200 bg-stone-100">
              <div
                className="aspect-[4/3]"
                style={{
                  backgroundImage: homeContent.heroPattern,
                }}
              />
            </div>
          </div>
          <div className="mx-auto grid max-w-6xl gap-4 px-4 pb-10 sm:px-6 lg:grid-cols-1">
            {renderStorefrontExtensions("home.hero.after", {}).map((entry) => (
              <div key={entry.key}>{entry.node}</div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">
                {homeContent.productsHeading}
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                {homeContent.productsDescription}
              </p>
            </div>
            <Link href="/products" className="text-sm font-semibold">
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
