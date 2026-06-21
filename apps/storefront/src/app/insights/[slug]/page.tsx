import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { JsonLd } from "@/components/json-ld"
import { SiteHeader } from "@/components/site-header"
import { retrieveContentEntry } from "@/lib/content"
import { resolveContentSeo } from "@/lib/content-seo"
import { buildPageMetadata, isIndexingEnabled } from "@/lib/seo"
import { getSiteConfig } from "@/lib/site-config"
import {
  articleJsonLd,
  breadcrumbJsonLd,
  faqPageJsonLd,
} from "@/lib/structured-data"
import { InsightDetailSections } from "@/sections/insights"

export const dynamic = "force-dynamic"

type InsightPageProps = {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({
  params,
}: InsightPageProps): Promise<Metadata> {
  const { slug } = await params
  const entry = await retrieveContentEntry(slug).catch(() => null)

  if (!entry) {
    return {}
  }

  const seo = resolveContentSeo(entry)
  const image =
    seo.ogImage || entry.cover_image_url || entry.cover_asset?.public_url || null

  return buildPageMetadata({
    title: seo.metaTitle || entry.title,
    description: seo.metaDescription || entry.excerpt,
    path: `/insights/${entry.slug}`,
    canonicalUrl: seo.canonicalUrl,
    image,
    type: "article",
    publishedTime: entry.published_at,
  })
}

export default async function InsightPage({ params }: InsightPageProps) {
  const { slug } = await params
  const siteConfig = getSiteConfig()
  const entry = await retrieveContentEntry(slug).catch(() => null)

  if (!entry) {
    notFound()
  }

  const faqPage = faqPageJsonLd(resolveContentSeo(entry).faq)

  return (
    <>
      {isIndexingEnabled() ? (
        <JsonLd
          data={[
            articleJsonLd(entry),
            breadcrumbJsonLd([
              { name: siteConfig.content.navigation.insights, path: "/insights" },
              { name: entry.title, path: `/insights/${entry.slug}` },
            ]),
            ...(faqPage ? [faqPage] : []),
          ]}
        />
      ) : null}
      <SiteHeader />
      <main className="theme-subtle-grid flex-1">
        <InsightDetailSections siteConfig={siteConfig} entry={entry} />
      </main>
    </>
  )
}
