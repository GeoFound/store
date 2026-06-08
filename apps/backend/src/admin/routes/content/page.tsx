import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Heading, Input, Table, Text, Textarea } from "@medusajs/ui"
import { FormEvent, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { AdminSection } from "../../components/admin-section"
import { LocalizedStatusSelect } from "../../components/localized-status-select"
import { MessageBox } from "../../components/message-box"
import { adminApi, formatDate } from "../../lib/admin-api"
import { translatedStatus } from "../../lib/i18n"

type ContentEntry = {
  id: string
  site_id: string
  slug: string
  title: string
  excerpt?: string | null
  body?: string | null
  content_type: string
  status: string
  author_name?: string | null
  topic?: string | null
  tags_json?: string[] | null
  related_product_handles_json?: string[] | null
  ai_assisted: boolean
  published_at?: string | null
  created_at?: string | null
}

const CONTENT_TYPE_OPTIONS = [
  "article",
  "guide",
  "report",
  "review",
  "resource",
  "case_study",
] as const
const CONTENT_STATUS_OPTIONS = ["draft", "review", "published", "archived"] as const

const EMPTY_ENTRY_FORM = {
  siteId: "site-1",
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  contentType: "article",
  status: "draft",
  authorName: "",
  topic: "",
  tags: "",
  relatedProductHandles: "",
  aiAssisted: false,
}

const ContentPage = () => {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<ContentEntry[]>([])
  const [form, setForm] = useState(EMPTY_ENTRY_FORM)
  const [filterSiteId, setFilterSiteId] = useState("site-1")
  const [filterStatus, setFilterStatus] = useState("published")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    void refresh()
  }, [])

  const metrics = useMemo(() => {
    const drafts = entries.filter((entry) => entry.status === "draft").length
    const review = entries.filter((entry) => entry.status === "review").length
    const published = entries.filter((entry) => entry.status === "published").length
    const aiAssisted = entries.filter((entry) => entry.ai_assisted).length

    return [
      {
        label: t("content.metrics.published"),
        value: published,
        detail: t("content.metrics.liveDetail"),
      },
      {
        label: t("content.metrics.review"),
        value: review,
        detail: t("content.metrics.reviewDetail"),
      },
      {
        label: t("content.metrics.drafts"),
        value: drafts,
        detail: t("content.metrics.draftDetail"),
      },
      {
        label: t("content.metrics.aiAssisted"),
        value: aiAssisted,
        detail: t("content.metrics.aiDetail"),
      },
    ]
  }, [entries, t])

  async function refresh() {
    setError("")
    const query = new URLSearchParams({
      limit: "100",
    })

    if (filterSiteId) {
      query.set("site_id", filterSiteId)
    }

    if (filterStatus) {
      query.set("status", filterStatus)
    }

    try {
      const data = await adminApi<{ entries: ContentEntry[] }>(
        `/admin/content/entries?${query.toString()}`
      )
      setEntries(data.entries || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t("content.loadFailed"))
    }
  }

  async function createEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    try {
      await adminApi("/admin/content/entries", {
        method: "POST",
        body: {
          site_id: form.siteId,
          title: form.title,
          slug: form.slug || slugFromTitle(form.title),
          excerpt: form.excerpt || null,
          body: form.body || null,
          content_type: form.contentType,
          status: form.status,
          author_name: form.authorName || null,
          topic: form.topic || null,
          tags: form.tags,
          related_product_handles: form.relatedProductHandles,
          ai_assisted: form.aiAssisted,
        },
      })

      setForm({
        ...EMPTY_ENTRY_FORM,
        siteId: form.siteId,
      })
      setFilterSiteId(form.siteId)
      setFilterStatus("")
      setMessage(t("content.created"))
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("content.createFailed"))
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(entry: ContentEntry, status: string) {
    setLoading(true)
    setError("")
    setMessage("")

    try {
      await adminApi(`/admin/content/entries/${entry.id}`, {
        method: "POST",
        body: {
          status,
        },
      })
      setMessage(t("content.updated"))
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("content.updateFailed"))
    } finally {
      setLoading(false)
    }
  }

  function setField<Key extends keyof typeof form>(
    key: Key,
    value: (typeof form)[Key]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  return (
    <div className="flex flex-col gap-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <AdminSection
            key={metric.label}
            title={metric.label}
            description={metric.detail}
          >
            <Heading level="h2">{metric.value}</Heading>
          </AdminSection>
        ))}
      </div>

      <AdminSection
        title={t("content.create.title")}
        description={t("content.create.description")}
      >
        <form onSubmit={createEntry} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Input
              value={form.siteId}
              onChange={(event) => setField("siteId", event.target.value)}
              placeholder={t("content.fields.siteId")}
            />
            <Input
              value={form.title}
              onChange={(event) => {
                const title = event.target.value
                setForm((current) => ({
                  ...current,
                  title,
                  slug: current.slug ? current.slug : slugFromTitle(title),
                }))
              }}
              placeholder={t("content.fields.title")}
            />
            <Input
              value={form.slug}
              onChange={(event) => setField("slug", event.target.value)}
              placeholder={t("content.fields.slug")}
            />
            <Input
              value={form.topic}
              onChange={(event) => setField("topic", event.target.value)}
              placeholder={t("content.fields.topic")}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <LocalizedStatusSelect
              value={form.contentType}
              onValueChange={(value) => setField("contentType", value)}
              options={CONTENT_TYPE_OPTIONS}
              placeholder={t("content.fields.type")}
            />
            <LocalizedStatusSelect
              value={form.status}
              onValueChange={(value) => setField("status", value)}
              options={CONTENT_STATUS_OPTIONS}
            />
            <Input
              value={form.authorName}
              onChange={(event) => setField("authorName", event.target.value)}
              placeholder={t("content.fields.author")}
            />
            <label className="flex min-h-10 items-center gap-2 text-sm text-ui-fg-subtle">
              <input
                type="checkbox"
                checked={form.aiAssisted}
                onChange={(event) => setField("aiAssisted", event.target.checked)}
              />
              {t("content.fields.aiAssisted")}
            </label>
          </div>

          <Textarea
            value={form.excerpt}
            onChange={(event) => setField("excerpt", event.target.value)}
            placeholder={t("content.fields.excerpt")}
          />
          <Textarea
            value={form.body}
            onChange={(event) => setField("body", event.target.value)}
            placeholder={t("content.fields.body")}
            rows={8}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              value={form.tags}
              onChange={(event) => setField("tags", event.target.value)}
              placeholder={t("content.fields.tags")}
            />
            <Input
              value={form.relatedProductHandles}
              onChange={(event) =>
                setField("relatedProductHandles", event.target.value)
              }
              placeholder={t("content.fields.relatedProducts")}
            />
          </div>
          <Button type="submit" disabled={loading}>
            {t("content.create.submit")}
          </Button>
        </form>
      </AdminSection>

      <AdminSection
        title={t("content.entries.title")}
        description={t("content.entries.description")}
      >
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <Input
            value={filterSiteId}
            onChange={(event) => setFilterSiteId(event.target.value)}
            placeholder={t("content.fields.siteId")}
          />
          <LocalizedStatusSelect
            value={filterStatus || "published"}
            onValueChange={(value) => setFilterStatus(value)}
            options={CONTENT_STATUS_OPTIONS}
          />
          <Button type="button" variant="secondary" onClick={() => void refresh()}>
            {t("common.actions.filter")}
          </Button>
        </div>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{t("content.fields.title")}</Table.HeaderCell>
              <Table.HeaderCell>{t("content.fields.siteId")}</Table.HeaderCell>
              <Table.HeaderCell>{t("content.fields.type")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.status")}</Table.HeaderCell>
              <Table.HeaderCell>{t("content.fields.topic")}</Table.HeaderCell>
              <Table.HeaderCell>{t("content.fields.aiAssisted")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.created")}</Table.HeaderCell>
              <Table.HeaderCell>{t("content.fields.actions")}</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {entries.map((entry) => (
              <Table.Row key={entry.id}>
                <Table.Cell>
                  <div className="min-w-0">
                    <Heading level="h3" className="truncate">
                      {entry.title}
                    </Heading>
                    <Text className="font-mono text-xs text-ui-fg-subtle">
                      {entry.slug}
                    </Text>
                    <Text className="mt-1 max-w-[360px] truncate text-ui-fg-subtle">
                      {entry.excerpt || entry.body || "-"}
                    </Text>
                  </div>
                </Table.Cell>
                <Table.Cell className="font-mono">{entry.site_id}</Table.Cell>
                <Table.Cell>{translatedStatus(t, entry.content_type)}</Table.Cell>
                <Table.Cell>
                  <Badge>{translatedStatus(t, entry.status)}</Badge>
                </Table.Cell>
                <Table.Cell>{entry.topic || "-"}</Table.Cell>
                <Table.Cell>
                  {entry.ai_assisted ? t("content.yes") : t("content.no")}
                </Table.Cell>
                <Table.Cell>{formatDate(entry.created_at)}</Table.Cell>
                <Table.Cell>
                  <div className="flex flex-wrap gap-2">
                    {entry.status !== "published" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={loading}
                        onClick={() => void updateStatus(entry, "published")}
                      >
                        {t("content.actions.publish")}
                      </Button>
                    ) : null}
                    {entry.status !== "review" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={loading}
                        onClick={() => void updateStatus(entry, "review")}
                      >
                        {t("content.actions.review")}
                      </Button>
                    ) : null}
                    {entry.status !== "archived" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={loading}
                        onClick={() => void updateStatus(entry, "archived")}
                      >
                        {t("content.actions.archive")}
                      </Button>
                    ) : null}
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
        {entries.length === 0 ? (
          <div className="px-2 py-4">
            <Text className="text-ui-fg-subtle">{t("content.empty")}</Text>
          </div>
        ) : null}
      </AdminSection>

      <MessageBox error={error} success={message} />
    </div>
  )
}

function slugFromTitle(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140)
}

export const config = defineRouteConfig({
  label: "adminRoutes.content",
  translationNs: "translation",
  rank: 27,
})

export default ContentPage
