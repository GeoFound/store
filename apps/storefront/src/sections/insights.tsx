import Link from "next/link"
import Image from "next/image"
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
                className="theme-card group flex min-h-[320px] flex-col overflow-hidden"
              >
                {entry.cover_image_url ? (
                  <div className="relative aspect-[16/9] w-full overflow-hidden">
                    <Image
                      src={entry.cover_image_url}
                      alt={entry.cover_asset?.alt_text || entry.title}
                      fill
                      sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                ) : null}
                <div className="flex flex-1 flex-col p-5">
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
                    {formatEntryMeta(entry)}
                  </span>
                  <span className="theme-accent-text font-semibold transition-transform group-hover:translate-x-1">
                    {insightsContent.readMoreLabel}
                  </span>
                </div>
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
          {entry.reading_time_minutes ? (
            <span className="opacity-60">{entry.reading_time_minutes} min</span>
          ) : null}
          {entry.language ? (
            <span className="font-mono text-xs uppercase opacity-60">
              {entry.language}
            </span>
          ) : null}
        </div>
        <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl">
          {entry.title}
        </h1>
        {entry.excerpt ? (
          <p className="mt-5 max-w-3xl text-lg leading-8 opacity-75">
            {entry.excerpt}
          </p>
        ) : null}
        {entry.cover_image_url ? (
          <div className="relative mt-7 aspect-[16/9] w-full overflow-hidden rounded-md">
            <Image
              src={entry.cover_image_url}
              alt={entry.cover_asset?.alt_text || entry.title}
              fill
              sizes="(min-width: 1024px) 760px, 100vw"
              className="object-cover"
            />
          </div>
        ) : null}
        {entry.audio_url ? (
          <audio
            className="mt-6 w-full max-w-3xl"
            controls
            preload="metadata"
            src={entry.audio_url}
          />
        ) : null}
      </div>

      <div className="theme-border mt-8 border-t pt-8">
        <div className="max-w-3xl space-y-5 text-base leading-8 opacity-85">
          <MarkdownLite body={entry.body || ""} />
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
  const headings = extractHeadings(entry.body || "")

  return (
    <aside
      {...sectionAttributes(section)}
      className="space-y-4 lg:sticky lg:top-24 lg:col-start-2 lg:h-fit"
    >
      {headings.length ? (
        <div className="theme-panel p-5">
          <h2 className="text-lg font-semibold">In this article</h2>
          <div className="mt-4 grid gap-2">
            {headings.map((heading) => (
              <a
                key={heading.id}
                href={`#${heading.id}`}
                className="text-sm font-medium opacity-70 hover:opacity-100"
              >
                {heading.text}
              </a>
            ))}
          </div>
        </div>
      ) : null}
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

function MarkdownLite({ body }: { body: string }) {
  const blocks = body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)

  return (
    <>
      {blocks.map((block, index) => {
        const heading = parseHeading(block)

        if (heading) {
          const HeadingTag = heading.level === 3 ? "h3" : "h2"

          return (
            <HeadingTag
              key={`${heading.id}-${index}`}
              id={heading.id}
              className={
                heading.level === 3
                  ? "pt-4 text-2xl font-semibold leading-tight"
                  : "pt-5 text-3xl font-semibold leading-tight"
              }
            >
              {heading.text}
            </HeadingTag>
          )
        }

        if (isListBlock(block)) {
          return (
            <ul key={block} className="list-disc space-y-2 pl-5">
              {block.split(/\n/).map((item) => (
                <li key={item}>{item.replace(/^[-*]\s+/, "")}</li>
              ))}
            </ul>
          )
        }

        return <p key={block}>{block}</p>
      })}
    </>
  )
}

function extractHeadings(body: string) {
  return body
    .split(/\n/)
    .map((line) => parseHeading(line.trim()))
    .filter((heading): heading is { id: string; level: number; text: string } =>
      Boolean(heading)
    )
    .slice(0, 8)
}

function parseHeading(value: string) {
  const match = /^(#{2,3})\s+(.+)$/.exec(value)

  if (!match) {
    return null
  }

  const text = match[2].trim()

  return {
    id: slugFromText(text),
    level: match[1].length,
    text,
  }
}

function isListBlock(value: string) {
  return value
    .split(/\n/)
    .every((line) => /^[-*]\s+/.test(line.trim()))
}

function slugFromText(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "section"
  )
}

function formatEntryMeta(entry: ContentEntry) {
  const date = formatDate(entry.published_at || entry.created_at)
  const reading = entry.reading_time_minutes
    ? `${entry.reading_time_minutes} min`
    : ""

  return [date, reading].filter(Boolean).join(" / ")
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
