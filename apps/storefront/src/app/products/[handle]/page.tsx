import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { retrieveProduct } from "@/lib/commerce"
import { getSiteConfig } from "@/lib/site-config"
import { applyProductDisplayEntry } from "@/lib/site-products"
import { ProductDetailSections } from "@/sections/product-detail"

export const dynamic = "force-dynamic"

type ProductPageProps = {
  params: Promise<{
    handle: string
  }>
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
      <SiteHeader />
      <main className="theme-subtle-grid flex-1">
        <ProductDetailSections siteConfig={siteConfig} product={product} />
      </main>
    </>
  )
}
