import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ProductPurchasePanel } from "@/components/product-purchase-panel"
import { SiteHeader } from "@/components/site-header"
import { retrieveProduct } from "@/lib/commerce"

export const dynamic = "force-dynamic"

type ProductPageProps = {
  params: Promise<{
    handle: string
  }>
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { handle } = await params
  const product = await retrieveProduct(handle)

  if (!product) {
    notFound()
  }

  const template = product.template

  return (
    <>
      <SiteHeader />
      <main className="theme-subtle-grid flex-1">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <section className="space-y-6">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 text-sm font-semibold opacity-75 hover:opacity-100"
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M19 12H5M11 6l-6 6 6 6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Back to products
            </Link>
            <div className="theme-panel theme-muted-surface relative aspect-[4/3] overflow-hidden bg-gradient-to-b from-white to-[var(--surface-muted)] shadow-[var(--shadow-card)]">
              {product.thumbnail ? (
                <Image
                  src={product.thumbnail}
                  alt={product.title}
                  fill
                  priority
                  sizes="(min-width: 1024px) 60vw, 100vw"
                  className="object-contain p-8"
                />
              ) : (
                <div className="theme-accent-surface flex h-full items-center justify-center text-7xl font-semibold">
                  {product.title.slice(0, 1)}
                </div>
              )}
            </div>
            <div className="theme-panel p-6">
              <h2 className="text-lg font-semibold">Product details</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 opacity-75">
                {product.description || "Digital product with manual delivery."}
              </p>
              {template ? (
                <div className="theme-border mt-5 grid gap-4 border-t pt-5 text-sm sm:grid-cols-3">
                  <div>
                    <div className="font-semibold text-[var(--foreground)]">
                      Delivery
                    </div>
                    <p className="mt-1 leading-6 opacity-75">
                      {template.deliveryLabel}
                    </p>
                  </div>
                  <div>
                    <div className="font-semibold text-[var(--foreground)]">
                      Fulfillment
                    </div>
                    <p className="mt-1 leading-6 opacity-75">
                      {template.title}
                    </p>
                  </div>
                  <div>
                    <div className="font-semibold text-[var(--foreground)]">
                      Access
                    </div>
                    <p className="mt-1 leading-6 opacity-75">
                      Guest order page
                    </p>
                  </div>
                </div>
              ) : null}
              {template ? (
                <div className="theme-border mt-5 border-t pt-5 text-sm opacity-75">
                  <div className="font-semibold text-[var(--foreground)]">
                    {template.title}
                  </div>
                  <p className="mt-1 leading-6">{template.description}</p>
                </div>
              ) : null}
            </div>
          </section>

          <aside className="theme-panel h-fit p-6 shadow-[var(--shadow-card)] lg:sticky lg:top-24">
            <ProductPurchasePanel
              productId={product.id}
              productTitle={product.title}
              template={template}
              variants={product.variants}
            />
          </aside>
        </div>
      </main>
    </>
  )
}
