import type { MetadataRoute } from "next"
import {
  AI_CRAWLERS,
  aiCrawlersAllowed,
  getSiteUrl,
  isIndexingEnabled,
} from "@/lib/seo"

export const dynamic = "force-dynamic"

// Non-public, non-indexable surfaces.
const PRIVATE_PATHS = ["/account", "/cart", "/checkout", "/orders", "/api/"]

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl()

  // Staging / SEO-disabled deployments: block everything, no sitemap.
  if (!isIndexingEnabled()) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    }
  }

  const rules: MetadataRoute.Robots["rules"] = [
    { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
  ]

  if (!aiCrawlersAllowed()) {
    rules.push({ userAgent: AI_CRAWLERS, disallow: "/" })
  }

  return {
    rules,
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
