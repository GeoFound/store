import type { Metadata } from "next"
import { SiteHeader } from "@/components/site-header"
import { listContentEntries } from "@/lib/content"
import { buildPageMetadata } from "@/lib/seo"
import { getSiteConfig } from "@/lib/site-config"
import { InsightsSections } from "@/sections/insights"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const siteConfig = getSiteConfig()

  return buildPageMetadata({
    title: siteConfig.content.insights.title,
    description: siteConfig.content.insights.description,
    path: "/insights",
    type: "website",
  })
}

export default async function InsightsPage() {
  const siteConfig = getSiteConfig()
  const entries = await listContentEntries({ limit: 24 }).catch(() => [])

  return (
    <>
      <SiteHeader />
      <main className="theme-subtle-grid flex-1">
        <InsightsSections siteConfig={siteConfig} entries={entries} />
      </main>
    </>
  )
}
