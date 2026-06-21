import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { retrieveContentEntry } from "@/lib/content"
import { buildPageMetadata } from "@/lib/seo"
import { getSiteConfig } from "@/lib/site-config"
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

  const image = entry.cover_image_url || entry.cover_asset?.public_url || null

  return buildPageMetadata({
    title: entry.title,
    description: entry.excerpt,
    path: `/insights/${entry.slug}`,
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

  return (
    <>
      <SiteHeader />
      <main className="theme-subtle-grid flex-1">
        <InsightDetailSections siteConfig={siteConfig} entry={entry} />
      </main>
    </>
  )
}
