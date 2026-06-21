import { absoluteUrl, getSiteUrl } from "@/lib/seo"
import { getSiteConfig } from "@/lib/site-config"
import type { ContentEntry, Product } from "@/lib/types"

/**
 * schema.org JSON-LD serializers (Phase 1). Each is a pure function over data
 * the storefront already has, so SEO, AEO (answer engines), and GEO (generative
 * engines) all read the same structured signals. New schema types are additive
 * — see docs/seo-aeo-geo-architecture.md.
 */

export type JsonLdObject = Record<string, unknown>

const SCHEMA_CONTEXT = "https://schema.org"

export function organizationJsonLd(): JsonLdObject {
  const { site } = getSiteConfig()
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Organization",
    name: site.name,
    url: getSiteUrl(),
    ...(site.description ? { description: site.description } : {}),
  }
}

export function websiteJsonLd(): JsonLdObject {
  const { site } = getSiteConfig()
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "WebSite",
    name: site.name,
    url: getSiteUrl(),
    ...(site.locale ? { inLanguage: site.locale } : {}),
  }
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; path: string }>
): JsonLdObject {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function productJsonLd(product: Product): JsonLdObject {
  const url = absoluteUrl(`/products/${product.handle}`)
  const variants = product.variants || []
  const prices = variants
    .map((variant) => variant.calculated_price?.calculated_amount)
    .filter((amount): amount is number => typeof amount === "number")
  const currency = variants
    .find((variant) => variant.calculated_price?.currency_code)
    ?.calculated_price?.currency_code
  const sku = variants.find((variant) => variant.sku)?.sku || undefined
  const inStock =
    !product.isSoldOut &&
    variants.some((variant) => variant.is_in_stock || variant.purchase_available)
  const availability = inStock
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock"

  const data: JsonLdObject = {
    "@context": SCHEMA_CONTEXT,
    "@type": "Product",
    name: product.title,
    url,
    ...(product.description ? { description: product.description } : {}),
    ...(product.thumbnail ? { image: absoluteUrl(product.thumbnail) } : {}),
    ...(sku ? { sku } : {}),
  }

  if (prices.length && currency) {
    const lowPrice = Math.min(...prices)
    const highPrice = Math.max(...prices)
    const priceCurrency = currency.toUpperCase()
    data.offers =
      prices.length > 1 && lowPrice !== highPrice
        ? {
            "@type": "AggregateOffer",
            lowPrice,
            highPrice,
            offerCount: prices.length,
            priceCurrency,
            availability,
            url,
          }
        : {
            "@type": "Offer",
            price: lowPrice,
            priceCurrency,
            availability,
            url,
          }
  }

  return data
}

export function articleJsonLd(entry: ContentEntry): JsonLdObject {
  const { site } = getSiteConfig()
  const url = absoluteUrl(`/insights/${entry.slug}`)
  const image = entry.cover_image_url || entry.cover_asset?.public_url || null
  const published = entry.published_at || entry.created_at || null

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Article",
    headline: entry.title,
    url,
    mainEntityOfPage: url,
    inLanguage: entry.language || site.locale,
    ...(entry.excerpt ? { description: entry.excerpt } : {}),
    ...(image ? { image: absoluteUrl(image) } : {}),
    ...(entry.author_name
      ? { author: { "@type": "Person", name: entry.author_name } }
      : {}),
    ...(published ? { datePublished: published, dateModified: published } : {}),
    publisher: {
      "@type": "Organization",
      name: site.name,
      url: getSiteUrl(),
    },
  }
}
