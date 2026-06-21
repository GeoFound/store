import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { JsonLd } from "@/components/json-ld"
import { SiteHeader } from "@/components/site-header"
import { retrieveProduct, retrieveSeoDocument } from "@/lib/commerce"
import { resolveSeoDocumentOverrides } from "@/lib/content-seo"
import { buildPageMetadata, isIndexingEnabled } from "@/lib/seo"
import { getSiteConfig } from "@/lib/site-config"
import { applyProductDisplayEntry } from "@/lib/site-products"
import {
  breadcrumbJsonLd,
  faqPageJsonLd,
  productJsonLd,
} from "@/lib/structured-data"
import type { Product } from "@/lib/types"
import { ProductDetailSections } from "@/sections/product-detail"

export const dynamic = "force-dynamic"

type ProductPageProps = {
  params: Promise<{
    handle: string
  }>
}

function productSeoDocument(product: Product, siteId: string) {
  return retrieveSeoDocument({
    entityType: "product",
    entityId: product.id,
    siteId,
  }).catch(() => null)
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { handle } = await params
  const product = await retrieveProduct(handle).catch(() => null)

  if (!product) {
    return {}
  }

  const seo = resolveSeoDocumentOverrides(
    await productSeoDocument(product, getSiteConfig().site.id)
  )

  return buildPageMetadata({
    title: seo.metaTitle || product.title,
    description: seo.metaDescription || product.description,
    path: `/products/${product.handle}`,
    canonicalUrl: seo.canonicalUrl,
    image: seo.ogImage || product.thumbnail,
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

  const seo = resolveSeoDocumentOverrides(
    await productSeoDocument(product, siteConfig.site.id)
  )
  const faqPage = faqPageJsonLd(seo.faq)

  return (
    <>
      {isIndexingEnabled() ? (
        <JsonLd
          data={[
            productJsonLd(product, seo.schemaJson),
            breadcrumbJsonLd([
              { name: siteConfig.content.navigation.products, path: "/products" },
              { name: product.title, path: `/products/${product.handle}` },
            ]),
            ...(faqPage ? [faqPage] : []),
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
