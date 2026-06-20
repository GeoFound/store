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
  content_format?: string
  content_type: string
  status: string
  author_name?: string | null
  cover_image_url?: string | null
  audio_url?: string | null
  language?: string | null
  topic?: string | null
  tags_json?: string[] | null
  related_product_handles_json?: string[] | null
  ai_assisted: boolean
  reading_time_minutes?: number | null
  word_count?: number | null
  published_at?: string | null
  created_at?: string | null
}

type ContentStorageProvider = {
  code: string
  label: string
  kind: "local" | "s3" | "r2" | "external"
  enabled: boolean
  bucket: string | null
  endpoint: string | null
  public_base_url: string | null
  upload_strategy: string
  status: string
  issues: string[]
}

type ContentStorageRuntime = {
  default_provider_code: string
  providers: ContentStorageProvider[]
  issues: string[]
}

type ContentAsset = {
  id: string
  site_id: string
  entry_id?: string | null
  asset_type: string
  storage_provider: string
  storage_provider_code?: string | null
  bucket?: string | null
  object_key?: string | null
  public_url?: string | null
  mime_type?: string | null
  created_at?: string | null
}

type ContentAudio = {
  id: string
  site_id: string
  entry_id: string
  asset_id?: string | null
  status: string
  provider_code?: string | null
  model?: string | null
  voice?: string | null
  language?: string | null
  duration_seconds?: number | null
  created_at?: string | null
}

type ContentAITaskRun = {
  id: string
  site_id: string
  entry_id?: string | null
  task_type: string
  provider_code?: string | null
  provider_protocol?: string | null
  provider_capability?: string | null
  model?: string | null
  status: string
  review_status: string
  input_summary?: string | null
  output_summary?: string | null
  error_message?: string | null
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
const CONTENT_FORMAT_OPTIONS = ["plain_text", "markdown", "html", "portable_json"] as const
const ASSET_TYPE_OPTIONS = [
  "cover_image",
  "inline_image",
  "audio",
  "attachment",
  "transcript",
  "source",
] as const
const AI_TASK_TYPE_OPTIONS = [
  "article_outline",
  "article_draft",
  "article_rewrite",
  "seo",
  "summary",
  "readability",
  "fact_check",
  "translation",
  "tts",
  "stt",
  "custom",
] as const

const EMPTY_ENTRY_FORM = {
  siteId: "site-1",
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  contentFormat: "markdown",
  contentType: "article",
  status: "draft",
  authorName: "",
  coverImageUrl: "",
  language: "",
  topic: "",
  tags: "",
  relatedProductHandles: "",
  aiAssisted: false,
}

const EMPTY_ASSET_FORM = {
  siteId: "site-1",
  entryId: "",
  assetType: "cover_image",
  storageProviderCode: "",
  publicUrl: "",
  objectKey: "",
  mimeType: "",
  altText: "",
  caption: "",
}

const EMPTY_AI_TASK_FORM = {
  siteId: "site-1",
  entryId: "",
  taskType: "article_draft",
  providerCode: "",
  providerProtocol: "",
  providerCapability: "text.generate",
  model: "",
  inputSummary: "",
}

const EMPTY_STORAGE: ContentStorageRuntime = {
  default_provider_code: "local",
  providers: [],
  issues: [],
}

const TASK_CAPABILITY_DEFAULTS: Record<string, string> = {
  article_outline: "text.generate",
  article_draft: "text.generate",
  article_rewrite: "text.generate",
  seo: "text.generate",
  summary: "text.generate",
  readability: "text.generate",
  fact_check: "text.generate",
  translation: "text.generate",
  tts: "speech.tts",
  stt: "speech.stt",
}

const ContentPage = () => {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<ContentEntry[]>([])
  const [assets, setAssets] = useState<ContentAsset[]>([])
  const [audio, setAudio] = useState<ContentAudio[]>([])
  const [tasks, setTasks] = useState<ContentAITaskRun[]>([])
  const [storage, setStorage] = useState<ContentStorageRuntime>(EMPTY_STORAGE)
  const [form, setForm] = useState(EMPTY_ENTRY_FORM)
  const [assetForm, setAssetForm] = useState(EMPTY_ASSET_FORM)
  const [aiTaskForm, setAiTaskForm] = useState(EMPTY_AI_TASK_FORM)
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
    const queuedTasks = tasks.filter((task) => task.status === "queued").length

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
        label: t("content.metrics.aiTasks"),
        value: queuedTasks,
        detail: t("content.metrics.aiTasksDetail"),
      },
    ]
  }, [entries, tasks, t])

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
      const [entriesData, storageData, assetsData, audioData, tasksData] =
        await Promise.all([
          adminApi<{ entries: ContentEntry[] }>(
            `/admin/content/entries?${query.toString()}`
          ),
          adminApi<ContentStorageRuntime>("/admin/content/storage/providers"),
          adminApi<{ assets: ContentAsset[] }>("/admin/content/assets?limit=25"),
          adminApi<{ audio: ContentAudio[] }>("/admin/content/audio?limit=25"),
          adminApi<{ tasks: ContentAITaskRun[] }>("/admin/content/ai/tasks?limit=25"),
        ])

      setEntries(entriesData.entries || [])
      setStorage(storageData || EMPTY_STORAGE)
      setAssets(assetsData.assets || [])
      setAudio(audioData.audio || [])
      setTasks(tasksData.tasks || [])
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
          content_format: form.contentFormat,
          content_type: form.contentType,
          status: form.status,
          author_name: form.authorName || null,
          cover_image_url: form.coverImageUrl || null,
          language: form.language || null,
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
      setAssetForm((current) => ({ ...current, siteId: form.siteId }))
      setAiTaskForm((current) => ({ ...current, siteId: form.siteId }))
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

  async function createAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    try {
      const provider = storage.providers.find(
        (item) => item.code === assetForm.storageProviderCode
      )

      await adminApi("/admin/content/assets", {
        method: "POST",
        body: {
          site_id: assetForm.siteId,
          entry_id: assetForm.entryId || null,
          asset_type: assetForm.assetType,
          storage_provider: provider?.kind,
          storage_provider_code: assetForm.storageProviderCode || null,
          public_url: assetForm.publicUrl || null,
          object_key: assetForm.objectKey || null,
          mime_type: assetForm.mimeType || null,
          alt_text: assetForm.altText || null,
          caption: assetForm.caption || null,
        },
      })

      setAssetForm({
        ...EMPTY_ASSET_FORM,
        siteId: assetForm.siteId,
        storageProviderCode: assetForm.storageProviderCode,
      })
      setMessage(t("content.assetCreated"))
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("content.assetCreateFailed"))
    } finally {
      setLoading(false)
    }
  }

  async function createAITask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    try {
      await adminApi("/admin/content/ai/tasks", {
        method: "POST",
        body: {
          site_id: aiTaskForm.siteId,
          entry_id: aiTaskForm.entryId || null,
          task_type: aiTaskForm.taskType,
          provider_code: aiTaskForm.providerCode || null,
          provider_protocol: aiTaskForm.providerProtocol || null,
          provider_capability:
            aiTaskForm.providerCapability ||
            TASK_CAPABILITY_DEFAULTS[aiTaskForm.taskType] ||
            "text.generate",
          model: aiTaskForm.model || null,
          status: "queued",
          review_status: "pending",
          input_summary: aiTaskForm.inputSummary || null,
        },
      })

      setAiTaskForm({
        ...EMPTY_AI_TASK_FORM,
        siteId: aiTaskForm.siteId,
        providerCode: aiTaskForm.providerCode,
        providerProtocol: aiTaskForm.providerProtocol,
        model: aiTaskForm.model,
      })
      setMessage(t("content.aiTaskCreated"))
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("content.aiTaskCreateFailed"))
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

  async function publishSnapshot(entry: ContentEntry) {
    setLoading(true)
    setError("")
    setMessage("")

    try {
      const data = await adminApi<{ revision: { id: string } }>(
        `/admin/content/entries/${entry.id}/revisions`,
        {
          method: "POST",
          body: {
            status: "review",
            change_note: "Admin publish snapshot",
          },
        }
      )

      await adminApi(`/admin/content/revisions/${data.revision.id}/publish`, {
        method: "POST",
        body: {
          channel: "storefront",
        },
      })

      setMessage(t("content.revisionPublished"))
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("content.updateFailed"))
    } finally {
      setLoading(false)
    }
  }

  async function queueEntryTask(entry: ContentEntry, taskType: string) {
    setLoading(true)
    setError("")
    setMessage("")

    try {
      await adminApi("/admin/content/ai/tasks", {
        method: "POST",
        body: {
          site_id: entry.site_id,
          entry_id: entry.id,
          task_type: taskType,
          provider_capability: TASK_CAPABILITY_DEFAULTS[taskType] || "text.generate",
          status: "queued",
          review_status: "pending",
          input_summary: `${taskType}: ${entry.title}`,
        },
      })

      setMessage(t("content.aiTaskCreated"))
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("content.aiTaskCreateFailed"))
    } finally {
      setLoading(false)
    }
  }

  async function registerAudioAsset(asset: ContentAsset) {
    if (!asset.entry_id) {
      return
    }

    setLoading(true)
    setError("")
    setMessage("")

    try {
      await adminApi("/admin/content/audio", {
        method: "POST",
        body: {
          site_id: asset.site_id,
          entry_id: asset.entry_id,
          asset_id: asset.id,
          status: "ready",
          metadata: {
            source: "admin_asset_registration",
          },
        },
      })

      await adminApi(`/admin/content/entries/${asset.entry_id}`, {
        method: "POST",
        body: {
          audio_asset_id: asset.id,
        },
      })

      setMessage(t("content.audioCreated"))
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("content.audioCreateFailed"))
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

  function setAssetField<Key extends keyof typeof assetForm>(
    key: Key,
    value: (typeof assetForm)[Key]
  ) {
    setAssetForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function setAiTaskField<Key extends keyof typeof aiTaskForm>(
    key: Key,
    value: (typeof aiTaskForm)[Key]
  ) {
    setAiTaskForm((current) => {
      const next = {
        ...current,
        [key]: value,
      }

      if (key === "taskType") {
        next.providerCapability =
          TASK_CAPABILITY_DEFAULTS[String(value)] || current.providerCapability
      }

      return next
    })
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
              value={form.contentFormat}
              onValueChange={(value) => setField("contentFormat", value)}
              options={CONTENT_FORMAT_OPTIONS}
              placeholder={t("content.fields.format")}
            />
            <LocalizedStatusSelect
              value={form.status}
              onValueChange={(value) => setField("status", value)}
              options={CONTENT_STATUS_OPTIONS}
            />
            <Input
              value={form.language}
              onChange={(event) => setField("language", event.target.value)}
              placeholder={t("content.fields.language")}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Input
              value={form.authorName}
              onChange={(event) => setField("authorName", event.target.value)}
              placeholder={t("content.fields.author")}
            />
            <Input
              value={form.coverImageUrl}
              onChange={(event) => setField("coverImageUrl", event.target.value)}
              placeholder={t("content.fields.coverImageUrl")}
            />
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

          <label className="flex min-h-10 items-center gap-2 text-sm text-ui-fg-subtle">
            <input
              type="checkbox"
              checked={form.aiAssisted}
              onChange={(event) => setField("aiAssisted", event.target.checked)}
            />
            {t("content.fields.aiAssisted")}
          </label>
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
          <Button type="submit" disabled={loading}>
            {t("content.create.submit")}
          </Button>
        </form>
      </AdminSection>

      <div className="grid gap-4 xl:grid-cols-2">
        <AdminSection
          title={t("content.storage.title")}
          description={t("content.storage.description")}
        >
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{t("content.fields.provider")}</Table.HeaderCell>
                <Table.HeaderCell>{t("content.fields.bucket")}</Table.HeaderCell>
                <Table.HeaderCell>{t("content.fields.strategy")}</Table.HeaderCell>
                <Table.HeaderCell>{t("common.fields.status")}</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {storage.providers.map((provider) => (
                <Table.Row key={provider.code}>
                  <Table.Cell>
                    <div>
                      <Heading level="h3">{provider.label}</Heading>
                      <Text className="font-mono text-xs text-ui-fg-subtle">
                        {provider.code} / {provider.kind}
                      </Text>
                    </div>
                  </Table.Cell>
                  <Table.Cell className="font-mono">
                    {provider.bucket || "-"}
                  </Table.Cell>
                  <Table.Cell>{provider.upload_strategy}</Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-col gap-1">
                      <Badge>{translatedStatus(t, provider.status)}</Badge>
                      {provider.issues.slice(0, 1).map((issue) => (
                        <Text key={issue} className="max-w-[240px] truncate text-ui-fg-error">
                          {issue}
                        </Text>
                      ))}
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </AdminSection>

        <AdminSection
          title={t("content.aiTasks.title")}
          description={t("content.aiTasks.description")}
        >
          <form onSubmit={createAITask} className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={aiTaskForm.siteId}
                onChange={(event) => setAiTaskField("siteId", event.target.value)}
                placeholder={t("content.fields.siteId")}
              />
              <Input
                value={aiTaskForm.entryId}
                onChange={(event) => setAiTaskField("entryId", event.target.value)}
                placeholder={t("content.fields.entryId")}
              />
              <LocalizedStatusSelect
                value={aiTaskForm.taskType}
                onValueChange={(value) => setAiTaskField("taskType", value)}
                options={AI_TASK_TYPE_OPTIONS}
                placeholder={t("content.fields.taskType")}
              />
              <Input
                value={aiTaskForm.providerCapability}
                onChange={(event) =>
                  setAiTaskField("providerCapability", event.target.value)
                }
                placeholder={t("content.fields.capability")}
              />
              <Input
                value={aiTaskForm.providerCode}
                onChange={(event) =>
                  setAiTaskField("providerCode", event.target.value)
                }
                placeholder={t("content.fields.providerCode")}
              />
              <Input
                value={aiTaskForm.model}
                onChange={(event) => setAiTaskField("model", event.target.value)}
                placeholder={t("content.fields.model")}
              />
            </div>
            <Textarea
              value={aiTaskForm.inputSummary}
              onChange={(event) =>
                setAiTaskField("inputSummary", event.target.value)
              }
              placeholder={t("content.fields.inputSummary")}
              rows={3}
            />
            <Button type="submit" disabled={loading}>
              {t("content.actions.queueAiTask")}
            </Button>
          </form>
        </AdminSection>
      </div>

      <AdminSection
        title={t("content.assets.title")}
        description={t("content.assets.description")}
      >
        <form onSubmit={createAsset} className="mb-4 grid gap-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input
              value={assetForm.siteId}
              onChange={(event) => setAssetField("siteId", event.target.value)}
              placeholder={t("content.fields.siteId")}
            />
            <Input
              value={assetForm.entryId}
              onChange={(event) => setAssetField("entryId", event.target.value)}
              placeholder={t("content.fields.entryId")}
            />
            <LocalizedStatusSelect
              value={assetForm.assetType}
              onValueChange={(value) => setAssetField("assetType", value)}
              options={ASSET_TYPE_OPTIONS}
              placeholder={t("content.fields.assetType")}
            />
            <Input
              value={assetForm.storageProviderCode}
              onChange={(event) =>
                setAssetField("storageProviderCode", event.target.value)
              }
              placeholder={t("content.fields.storageProviderCode")}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              value={assetForm.publicUrl}
              onChange={(event) => setAssetField("publicUrl", event.target.value)}
              placeholder={t("content.fields.publicUrl")}
            />
            <Input
              value={assetForm.objectKey}
              onChange={(event) => setAssetField("objectKey", event.target.value)}
              placeholder={t("content.fields.objectKey")}
            />
            <Input
              value={assetForm.mimeType}
              onChange={(event) => setAssetField("mimeType", event.target.value)}
              placeholder={t("content.fields.mimeType")}
            />
            <Input
              value={assetForm.altText}
              onChange={(event) => setAssetField("altText", event.target.value)}
              placeholder={t("content.fields.altText")}
            />
          </div>
          <Button type="submit" disabled={loading}>
            {t("content.actions.createAsset")}
          </Button>
        </form>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{t("content.fields.asset")}</Table.HeaderCell>
              <Table.HeaderCell>{t("content.fields.entryId")}</Table.HeaderCell>
              <Table.HeaderCell>{t("content.fields.provider")}</Table.HeaderCell>
              <Table.HeaderCell>{t("content.fields.url")}</Table.HeaderCell>
              <Table.HeaderCell>{t("content.fields.actions")}</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {assets.map((asset) => (
              <Table.Row key={asset.id}>
                <Table.Cell>
                  <div>
                    <Badge>{translatedStatus(t, asset.asset_type)}</Badge>
                    <Text className="mt-1 font-mono text-xs text-ui-fg-subtle">
                      {asset.id}
                    </Text>
                  </div>
                </Table.Cell>
                <Table.Cell className="font-mono">{asset.entry_id || "-"}</Table.Cell>
                <Table.Cell className="font-mono">
                  {asset.storage_provider_code || asset.storage_provider}
                </Table.Cell>
                <Table.Cell className="max-w-[360px] truncate font-mono">
                  {asset.public_url || asset.object_key || "-"}
                </Table.Cell>
                <Table.Cell>
                  {asset.asset_type === "audio" && asset.entry_id ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={loading}
                      onClick={() => void registerAudioAsset(asset)}
                    >
                      {t("content.actions.registerAudio")}
                    </Button>
                  ) : (
                    "-"
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
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
              <Table.HeaderCell>{t("content.fields.reading")}</Table.HeaderCell>
              <Table.HeaderCell>{t("content.fields.media")}</Table.HeaderCell>
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
                <Table.Cell>
                  <div className="flex flex-col gap-1">
                    <Text>{translatedStatus(t, entry.content_type)}</Text>
                    <Text className="font-mono text-xs text-ui-fg-subtle">
                      {entry.content_format || "plain_text"}
                    </Text>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Badge>{translatedStatus(t, entry.status)}</Badge>
                </Table.Cell>
                <Table.Cell>
                  <Text>
                    {entry.reading_time_minutes
                      ? t("content.reading.minutes", {
                          count: entry.reading_time_minutes,
                        })
                      : "-"}
                  </Text>
                  <Text className="text-xs text-ui-fg-subtle">
                    {entry.word_count
                      ? t("content.reading.words", { count: entry.word_count })
                      : entry.language || "-"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex flex-col gap-1">
                    <Text>{entry.cover_image_url ? t("content.media.cover") : "-"}</Text>
                    <Text>{entry.audio_url ? t("content.media.audio") : ""}</Text>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={loading}
                      onClick={() => void publishSnapshot(entry)}
                    >
                      {t("content.actions.publishSnapshot")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={loading}
                      onClick={() => void queueEntryTask(entry, "article_draft")}
                    >
                      {t("content.actions.aiDraft")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={loading}
                      onClick={() => void queueEntryTask(entry, "tts")}
                    >
                      {t("content.actions.tts")}
                    </Button>
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

      <div className="grid gap-4 xl:grid-cols-2">
        <AdminSection
          title={t("content.audio.title")}
          description={t("content.audio.description")}
        >
          <CompactRows
            rows={audio.map((item) => ({
              id: item.id,
              title: item.voice || item.model || item.id,
              detail: `${item.entry_id} / ${item.provider_code || "-"}`,
              status: item.status,
              createdAt: item.created_at,
            }))}
            empty={t("content.audio.empty")}
          />
        </AdminSection>

        <AdminSection
          title={t("content.aiTasks.recentTitle")}
          description={t("content.aiTasks.recentDescription")}
        >
          <CompactRows
            rows={tasks.map((task) => ({
              id: task.id,
              title: task.task_type,
              detail: `${task.provider_capability || "-"} / ${task.provider_code || "-"}`,
              status: task.status,
              createdAt: task.created_at,
            }))}
            empty={t("content.aiTasks.empty")}
          />
        </AdminSection>
      </div>

      <MessageBox error={error} success={message} />
    </div>
  )
}

function CompactRows(props: {
  rows: Array<{
    id: string
    title: string
    detail: string
    status: string
    createdAt?: string | null
  }>
  empty: string
}) {
  const { t } = useTranslation()

  if (!props.rows.length) {
    return <Text className="text-ui-fg-subtle">{props.empty}</Text>
  }

  return (
    <div className="divide-y rounded-md border border-ui-border-base">
      {props.rows.map((row) => (
        <div key={row.id} className="grid gap-2 px-4 py-3 md:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <Text className="font-medium">{row.title}</Text>
            <Text className="truncate font-mono text-xs text-ui-fg-subtle">
              {row.detail}
            </Text>
          </div>
          <div className="flex items-center gap-3">
            <Badge>{translatedStatus(t, row.status)}</Badge>
            <Text className="text-xs text-ui-fg-subtle">{formatDate(row.createdAt)}</Text>
          </div>
        </div>
      ))}
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
