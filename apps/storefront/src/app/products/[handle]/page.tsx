import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ProductPurchasePanel } from "@/components/product-purchase-panel"
import { SiteHeader } from "@/components/site-header"
import { retrieveProduct } from "@/lib/medusa"

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
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_420px]">
        <section className="space-y-6">
          <div className="relative aspect-[4/3] overflow-hidden border border-stone-200 bg-stone-100">
            {product.thumbnail ? (
              <Image
                src={product.thumbnail}
                alt={product.title}
                fill
                priority
                sizes="(min-width: 1024px) 60vw, 100vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-teal-700 text-7xl font-semibold text-white">
                {product.title.slice(0, 1)}
              </div>
            )}
          </div>
          <div className="border border-stone-200 bg-white p-5">
            <h2 className="text-lg font-semibold">Product details</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-stone-700">
              {product.description || "Digital product with manual delivery."}
            </p>
            {template ? (
              <div className="mt-4 border-t border-stone-200 pt-4 text-sm text-stone-700">
                <div className="font-semibold text-stone-950">{template.title}</div>
                <p className="mt-1 leading-6">{template.description}</p>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="h-fit border border-stone-200 bg-white p-5">
          <Link href="/products" className="text-sm text-stone-600">
            Back to products
          </Link>
          <ProductPurchasePanel
            productId={product.id}
            productTitle={product.title}
            template={template}
            variants={product.variants}
          />
        </aside>
      </main>
    </>
  )
}
