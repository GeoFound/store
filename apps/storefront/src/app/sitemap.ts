import type { MetadataRoute } from "next"
import { listProducts } from "@/lib/commerce"
import { listContentEntries } from "@/lib/content"
import { absoluteUrl, isIndexingEnabled } from "@/lib/seo"

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // A non-indexable deployment must not advertise URLs.
  if (!isIndexingEnabled()) {
    return []
  }

  const now = new Date()
  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    {
      url: absoluteUrl("/products"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/insights"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ]

  const [products, insights] = await Promise.all([
    listProducts().catch(() => []),
    listContentEntries({ limit: 1000 }).catch(() => []),
  ])

  for (const product of products) {
    if (!product.handle) {
      continue
    }
    entries.push({
      url: absoluteUrl(`/products/${product.handle}`),
      lastModified: product.updated_at ? new Date(product.updated_at) : now,
      changeFrequency: "weekly",
      priority: 0.7,
    })
  }

  for (const entry of insights) {
    if (!entry.slug) {
      continue
    }
    const lastModified = entry.published_at || entry.created_at
    entries.push({
      url: absoluteUrl(`/insights/${entry.slug}`),
      lastModified: lastModified ? new Date(lastModified) : now,
      changeFrequency: "weekly",
      priority: 0.5,
    })
  }

  return entries
}
