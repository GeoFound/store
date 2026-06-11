import Link from "next/link"
import type {
  SiteConfig,
  SiteExperienceSectionConfig,
} from "@/lib/site-config"
import type { ContentEntry } from "@/lib/types"
import { renderConfiguredSections, sectionAttributes } from "./shared"

type InsightsSectionsProps = {
  siteConfig: SiteConfig
  entries: ContentEntry[]
}

type InsightDetailSectionsProps = {
  siteConfig: SiteConfig
  entry: ContentEntry
}

export function InsightsSections({
  siteConfig,
  entries,
}: InsightsSectionsProps) {
  return (
    <>
      {renderConfiguredSections(
        siteConfig.experience.pages.insights.sections,
        (section) => {
          if (section.type === "content-list") {
            return (
              <ContentListSection
                section={section}
                siteConfig={siteConfig}
                entries={entries}
              />
            )
          }

          return null
        }
      )}
    </>
  )
}

export function InsightDetailSections({
  siteConfig,
  entry,
}: InsightDetailSectionsProps) {
  return (
    <article className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      {renderConfiguredSections(
        siteConfig.experience.pages["insight-detail"].sections,
        (section) => {
          if (section.type === "content-article") {
            return (
              <ContentArticleSection
                section={section}
                siteConfig={siteConfig}
                entry={entry}
              />
            )
          }

          if (section.type === "featured-products") {
            return (
              <RelatedProductsSection
                section={section}
                siteConfig={siteConfig}
                entry={entry}
              />
            )
          }

          return null
        }
      )}
    </article>
  )
}

function ContentListSection({
  section,
  siteConfig,
  entries,
}: {
  section: SiteExperienceSectionConfig
  siteConfig: SiteConfig
  entries: ContentEntry[]
}) {
  const insightsContent = siteConfig.content.insights

  return (
    <section {...sectionAttributes(section)}>
      <div className="theme-border border-b">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
          <div className="max-w-3xl">
            <p className="theme-accent-text text-sm font-semibold">
              {siteConfig.site.name}
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
              {insightsContent.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 opacity-75">
              {insightsContent.description}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {entries.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {entries.map((entry) => (
              <Link
                key={entry.id}
                href={`/insights/${entry.slug}`}
                className="theme-card group flex min-h-[260px] flex-col p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="theme-accent-surface px-3 py-1 text-xs font-semibold uppercase">
                    {formatContentType(entry.content_type)}
                  </span>
                  {entry.topic ? (
                    <span className="text-xs font-medium opacity-60">
                      {entry.topic}
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-5 text-xl font-semibold leading-tight">
                  {entry.title}
                </h2>
                <p className="mt-3 line-clamp-4 text-sm leading-6 opacity-75">
                  {entry.excerpt || entry.body}
                </p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-6 text-sm">
                  <span className="opacity-60">
                    {formatDate(entry.published_at || entry.created_at)}
                  </span>
                  <span className="theme-accent-text font-semibold transition-transform group-hover:translate-x-1">
                    {insightsContent.readMoreLabel}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="theme-panel max-w-2xl p-6">
            <h2 className="text-2xl font-semibold">
              {insightsContent.emptyTitle}
            </h2>
            <p className="mt-3 text-sm leading-6 opacity-75">
              {insightsContent.emptyDescription}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

function ContentArticleSection({
  section,
  siteConfig,
  entry,
}: {
  section: SiteExperienceSectionConfig
  siteConfig: SiteConfig
  entry: ContentEntry
}) {
  const insightsContent = siteConfig.content.insights

  return (
    <section
      {...sectionAttributes(section)}
      className="theme-panel p-6 shadow-[var(--shadow-card)] sm:p-8 lg:col-start-1"
    >
      <Link
        href="/insights"
        className="inline-flex items-center gap-2 text-sm font-semibold opacity-75 hover:opacity-100"
      >
        <span aria-hidden="true">&larr;</span>
        {insightsContent.backLabel}
      </Link>
      <div className="mt-8">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="theme-accent-surface px-3 py-1 font-semibold uppercase">
            {formatContentType(entry.content_type)}
          </span>
          {entry.topic ? <span className="opacity-60">{entry.topic}</span> : null}
          <span className="opacity-60">
            {insightsContent.publishedLabel}{" "}
            {formatDate(entry.published_at || entry.created_at)}
          </span>
        </div>
        <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl">
          {entry.title}
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 opacity-75">
          {entry.excerpt}
        </p>
      </div>

      <div className="theme-border mt-8 border-t pt-8">
        <div className="max-w-3xl space-y-5 text-base leading-8 opacity-85">
          {entry.body.split(/\n{2,}/).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </div>
    </section>
  )
}

function RelatedProductsSection({
  section,
  siteConfig,
  entry,
}: {
  section: SiteExperienceSectionConfig
  siteConfig: SiteConfig
  entry: ContentEntry
}) {
  const relatedHandles = entry.related_product_handles_json || []
  const insightsContent = siteConfig.content.insights

  return (
    <aside
      {...sectionAttributes(section)}
      className="space-y-4 lg:sticky lg:top-24 lg:col-start-2 lg:h-fit"
    >
      <div className="theme-panel p-5">
        <h2 className="text-lg font-semibold">
          {insightsContent.relatedProductsLabel}
        </h2>
        {relatedHandles.length ? (
          <div className="mt-4 grid gap-2">
            {relatedHandles.map((handle) => (
              <Link
                key={handle}
                href={`/products/${handle}`}
                className="theme-secondary-action inline-flex min-h-10 items-center px-3 text-sm font-semibold"
              >
                {handle}
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 opacity-70">
            {siteConfig.content.catalog.description}
          </p>
        )}
      </div>
      {entry.tags_json?.length ? (
        <div className="theme-panel p-5">
          <h2 className="text-lg font-semibold">Topics</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {entry.tags_json.map((tag) => (
              <span
                key={tag}
                className="theme-accent-surface px-3 py-1 text-xs font-semibold"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  )
}

function formatContentType(value: string) {
  return value.replace(/_/g, " ")
}

function formatDate(value?: string | null) {
  if (!value) {
    return ""
  }

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
