import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { JsonLd } from "@/components/json-ld"
import { SiteHeader } from "@/components/site-header"
import { retrieveProduct } from "@/lib/commerce"
import { buildPageMetadata, isIndexingEnabled } from "@/lib/seo"
import { getSiteConfig } from "@/lib/site-config"
import { applyProductDisplayEntry } from "@/lib/site-products"
import { breadcrumbJsonLd, productJsonLd } from "@/lib/structured-data"
import { ProductDetailSections } from "@/sections/product-detail"

export const dynamic = "force-dynamic"

type ProductPageProps = {
  params: Promise<{
    handle: string
  }>
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { handle } = await params
  const product = await retrieveProduct(handle).catch(() => null)

  if (!product) {
    return {}
  }

  return buildPageMetadata({
    title: product.title,
    description: product.description,
    path: `/products/${product.handle}`,
    image: product.thumbnail,
    type: "website",
  })
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { handle } = await params
  const siteConfig = getSiteConfig()
  const rawProduct = await retrieveProduct(handle).catch(() => null)

  if (!rawProduct) {
    notFound()
  }

  const product = applyProductDisplayEntry(
    rawProduct,
    siteConfig.content.catalog.productDisplay.find(
      (entry) => entry.handle === rawProduct.handle
    )
  )

  return (
    <>
      {isIndexingEnabled() ? (
        <JsonLd
          data={[
            productJsonLd(product),
            breadcrumbJsonLd([
              { name: siteConfig.content.navigation.products, path: "/products" },
              { name: product.title, path: `/products/${product.handle}` },
            ]),
          ]}
        />
      ) : null}
      <SiteHeader />
      <main className="theme-subtle-grid flex-1">
        <ProductDetailSections siteConfig={siteConfig} product={product} />
      </main>
    </>
  )
}
