import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { retrieveContentEntry } from "@/lib/content"
import { getSiteConfig } from "@/lib/site-config"
import { InsightDetailSections } from "@/sections/insights"

export const dynamic = "force-dynamic"

type InsightPageProps = {
  params: Promise<{
    slug: string
  }>
}

export default async function InsightPage({ params }: InsightPageProps) {
  const { slug } = await params
  const siteConfig = getSiteConfig()
  const entry = await retrieveContentEntry(slug)

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
