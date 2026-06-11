import Image from "next/image"
import Link from "next/link"
import { ProductPurchasePanel } from "@/components/product-purchase-panel"
import type {
  SiteConfig,
  SiteExperienceSectionConfig,
} from "@/lib/site-config"
import type { Product } from "@/lib/types"
import { renderConfiguredSections, sectionAttributes } from "./shared"

type ProductDetailSectionsProps = {
  siteConfig: SiteConfig
  product: Product
}

export function ProductDetailSections({
  siteConfig,
  product,
}: ProductDetailSectionsProps) {
  const template = product.template

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      {renderConfiguredSections(
        siteConfig.experience.pages["product-detail"].sections,
        (section) => {
          if (section.type === "product-media") {
            return <ProductMediaSection section={section} product={product} />
          }

          if (section.type === "product-purchase") {
            return (
              <ProductPurchaseSection section={section} product={product} />
            )
          }

          if (section.type === "product-details") {
            return (
              <ProductDetailsSection
                section={section}
                product={product}
                template={template}
              />
            )
          }

          return null
        }
      )}
    </div>
  )
}

function ProductMediaSection({
  section,
  product,
}: {
  section: SiteExperienceSectionConfig
  product: Product
}) {
  return (
    <section
      {...sectionAttributes(section)}
      className="space-y-6 lg:col-start-1"
    >
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
    </section>
  )
}

function ProductPurchaseSection({
  section,
  product,
}: {
  section: SiteExperienceSectionConfig
  product: Product
}) {
  return (
    <aside
      {...sectionAttributes(section)}
      className="theme-panel h-fit p-6 shadow-[var(--shadow-card)] lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2"
    >
      <ProductPurchasePanel
        productId={product.id}
        productTitle={product.title}
        template={product.template}
        variants={product.variants}
        hideVariantSelector={product.display?.hideVariantSelector}
      />
    </aside>
  )
}

function ProductDetailsSection({
  section,
  product,
  template,
}: {
  section: SiteExperienceSectionConfig
  product: Product
  template: Product["template"]
}) {
  return (
    <section
      {...sectionAttributes(section)}
      className="theme-panel p-6 lg:col-start-1"
    >
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
            <p className="mt-1 leading-6 opacity-75">{template.title}</p>
          </div>
          <div>
            <div className="font-semibold text-[var(--foreground)]">
              Access
            </div>
            <p className="mt-1 leading-6 opacity-75">Guest order page</p>
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
    </section>
  )
}
