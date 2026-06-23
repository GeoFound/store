"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"
import { adminApi } from "@/lib/admin-api"
import { formatDate } from "@/lib/format"
import {
  Field,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  TextAreaInput,
  TextInput,
} from "./admin-controls"
import { Message, MetricCard, PageHeader, Panel, TableShell } from "./admin-page"
import { StatusBadge } from "./status-badge"

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
  language?: string | null
  cover_image_url?: string | null
  audio_url?: string | null
  reading_time_minutes?: number | null
  word_count?: number | null
}

type StorageProvider = {
  code: string
  label: string
  kind: "local" | "s3" | "r2" | "external"
  bucket: string | null
  upload_strategy: string
  status: string
  issues: string[]
}

type StorageRuntime = {
  default_provider_code: string
  providers: StorageProvider[]
  issues: string[]
}

type ContentAsset = {
  id: string
  site_id: string
  entry_id?: string | null
  asset_type: string
  storage_provider: string
  storage_provider_code?: string | null
  public_url?: string | null
  object_key?: string | null
}

type ContentAudio = {
  id: string
  entry_id: string
  status: string
  provider_code?: string | null
  model?: string | null
  voice?: string | null
  created_at?: string | null
}

type ContentAITaskRun = {
  id: string
  task_type: string
  provider_code?: string | null
  provider_capability?: string | null
  status: string
  review_status?: string | null
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
const CONTENT_FORMAT_OPTIONS = [
  "plain_text",
  "markdown",
  "html",
  "portable_json",
] as const
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

const EMPTY_ENTRY = {
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

const EMPTY_ASSET = {
  siteId: "site-1",
  entryId: "",
  assetType: "cover_image",
  storageProviderCode: "",
  filename: "",
  publicUrl: "",
  objectKey: "",
  mimeType: "",
  altText: "",
}

const EMPTY_AI_TASK = {
  siteId: "site-1",
  entryId: "",
  taskType: "article_draft",
  providerCapability: "text.generate",
  providerCode: "",
  model: "",
  inputSummary: "",
}

type Filters = { siteId: string; status: string }

async function loadContent(filters: Filters) {
  const query = new URLSearchParams({ limit: "100" })
  if (filters.siteId) {
    query.set("site_id", filters.siteId)
  }
  if (filters.status) {
    query.set("status", filters.status)
  }

  const [entries, storage, assets, audio, tasks] = await Promise.all([
    adminApi<{ entries: ContentEntry[] }>(
      `/admin/content/entries?${query.toString()}`,
    ),
    adminApi<StorageRuntime>("/admin/content/storage/providers"),
    adminApi<{ assets: ContentAsset[] }>("/admin/content/assets?limit=25"),
    adminApi<{ audio: ContentAudio[] }>("/admin/content/audio?limit=25"),
    adminApi<{ tasks: ContentAITaskRun[] }>("/admin/content/ai/tasks?limit=25"),
  ])

  return {
    entries: entries.entries || [],
    storage: storage || { default_provider_code: "local", providers: [], issues: [] },
    assets: assets.assets || [],
    audio: audio.audio || [],
    tasks: tasks.tasks || [],
  }
}

export function ContentView() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<Filters>({
    siteId: "site-1",
    status: "published",
  })
  const [filterDraft, setFilterDraft] = useState<Filters>(filters)
  const [entryForm, setEntryForm] = useState(EMPTY_ENTRY)
  const [assetForm, setAssetForm] = useState(EMPTY_ASSET)
  const [aiTaskForm, setAiTaskForm] = useState(EMPTY_AI_TASK)
  const [uploadPolicyPreview, setUploadPolicyPreview] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const contentQuery = useQuery({
    queryKey: ["content", filters],
    queryFn: () => loadContent(filters),
  })
  const data = contentQuery.data

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["content"] })

  const ok = (text: string) => {
    setMessage(text)
    setError("")
    return invalidate()
  }

  const createEntry = useMutation({
    mutationFn: async () => {
      if (!entryForm.title.trim()) {
        throw new Error("标题必填。")
      }

      return adminApi("/admin/content/entries", {
        method: "POST",
        body: {
          site_id: entryForm.siteId,
          title: entryForm.title.trim(),
          slug: entryForm.slug.trim() || slugFromTitle(entryForm.title),
          excerpt: entryForm.excerpt.trim() || null,
          body: entryForm.body.trim() || null,
          content_format: entryForm.contentFormat,
          content_type: entryForm.contentType,
          status: entryForm.status,
          author_name: entryForm.authorName.trim() || null,
          cover_image_url: entryForm.coverImageUrl.trim() || null,
          language: entryForm.language.trim() || null,
          topic: entryForm.topic.trim() || null,
          tags: entryForm.tags,
          related_product_handles: entryForm.relatedProductHandles,
          ai_assisted: entryForm.aiAssisted,
        },
      })
    },
    onSuccess: async () => {
      setEntryForm({ ...EMPTY_ENTRY, siteId: entryForm.siteId })
      await ok("内容条目已创建。")
    },
    onError: (err) => setError(errorMessage(err)),
  })

  const createAsset = useMutation({
    mutationFn: async () => {
      const provider = data?.storage.providers.find(
        (item) => item.code === assetForm.storageProviderCode,
      )

      return adminApi("/admin/content/assets", {
        method: "POST",
        body: {
          site_id: assetForm.siteId,
          entry_id: assetForm.entryId.trim() || null,
          asset_type: assetForm.assetType,
          storage_provider: provider?.kind,
          storage_provider_code: assetForm.storageProviderCode.trim() || null,
          public_url: assetForm.publicUrl.trim() || null,
          object_key: assetForm.objectKey.trim() || null,
          mime_type: assetForm.mimeType.trim() || null,
          alt_text: assetForm.altText.trim() || null,
        },
      })
    },
    onSuccess: async () => {
      setAssetForm({
        ...EMPTY_ASSET,
        siteId: assetForm.siteId,
        storageProviderCode: assetForm.storageProviderCode,
      })
      await ok("素材已登记。")
    },
    onError: (err) => setError(errorMessage(err)),
  })

  const createUploadPolicy = useMutation({
    mutationFn: async () => {
      if (!assetForm.filename.trim() && !assetForm.objectKey.trim()) {
        throw new Error("生成上传策略需要 filename 或 object_key。")
      }

      return adminApi<{ upload: unknown }>("/admin/content/assets/upload-policy", {
        method: "POST",
        body: {
          site_id: assetForm.siteId.trim() || null,
          entry_id: assetForm.entryId.trim() || null,
          asset_type: assetForm.assetType,
          storage_provider_code: assetForm.storageProviderCode.trim() || null,
          filename: assetForm.filename.trim() || assetForm.objectKey.trim() || null,
          mime_type: assetForm.mimeType.trim() || null,
          expires_in_seconds: 900,
        },
      })
    },
    onSuccess: async (data) => {
      setUploadPolicyPreview(JSON.stringify(data.upload, null, 2))
      await ok("上传策略已生成。")
    },
    onError: (err) => setError(errorMessage(err)),
  })

  const createAiTask = useMutation({
    mutationFn: async () =>
      adminApi("/admin/content/ai/tasks", {
        method: "POST",
        body: {
          site_id: aiTaskForm.siteId,
          entry_id: aiTaskForm.entryId.trim() || null,
          task_type: aiTaskForm.taskType,
          provider_code: aiTaskForm.providerCode.trim() || null,
          provider_capability:
            aiTaskForm.providerCapability.trim() ||
            TASK_CAPABILITY_DEFAULTS[aiTaskForm.taskType] ||
            "text.generate",
          model: aiTaskForm.model.trim() || null,
          status: "queued",
          review_status: "pending",
          input_summary: aiTaskForm.inputSummary.trim() || null,
        },
      }),
    onSuccess: async () => {
      setAiTaskForm({
        ...EMPTY_AI_TASK,
        siteId: aiTaskForm.siteId,
        providerCode: aiTaskForm.providerCode,
        model: aiTaskForm.model,
      })
      await ok("AI 任务已入队。")
    },
    onError: (err) => setError(errorMessage(err)),
  })

  const runContentAiTask = useMutation({
    mutationFn: () =>
      adminApi("/admin/content/ai/run", {
        method: "POST",
        body: {
          site_id: aiTaskForm.siteId,
          entry_id: aiTaskForm.entryId.trim() || null,
          task_type: aiTaskForm.taskType,
          provider_code: aiTaskForm.providerCode.trim() || null,
          model: aiTaskForm.model.trim() || null,
          input_summary: aiTaskForm.inputSummary.trim() || null,
          input: { source: "admin_content_view" },
        },
      }),
    onSuccess: async () => {
      setAiTaskForm({
        ...EMPTY_AI_TASK,
        siteId: aiTaskForm.siteId,
        providerCode: aiTaskForm.providerCode,
        model: aiTaskForm.model,
      })
      await ok("AI 任务已运行。")
    },
    onError: (err) => setError(errorMessage(err)),
  })

  const updateStatus = useMutation({
    mutationFn: (input: { id: string; status: string }) =>
      adminApi(`/admin/content/entries/${input.id}`, {
        method: "POST",
        body: { status: input.status },
      }),
    onSuccess: () => ok("条目已更新。"),
    onError: (err) => setError(errorMessage(err)),
  })

  const publishSnapshot = useMutation({
    mutationFn: async (entry: ContentEntry) => {
      const data = await adminApi<{ revision: { id: string } }>(
        `/admin/content/entries/${entry.id}/revisions`,
        {
          method: "POST",
          body: { status: "review", change_note: "Admin publish snapshot" },
        },
      )

      return adminApi(`/admin/content/revisions/${data.revision.id}/publish`, {
        method: "POST",
        body: { channel: "storefront" },
      })
    },
    onSuccess: () => ok("修订已发布。"),
    onError: (err) => setError(errorMessage(err)),
  })

  const queueEntryTask = useMutation({
    mutationFn: (input: { entry: ContentEntry; taskType: string }) =>
      adminApi("/admin/content/ai/tasks", {
        method: "POST",
        body: {
          site_id: input.entry.site_id,
          entry_id: input.entry.id,
          task_type: input.taskType,
          provider_capability:
            TASK_CAPABILITY_DEFAULTS[input.taskType] || "text.generate",
          status: "queued",
          review_status: "pending",
          input_summary: `${input.taskType}: ${input.entry.title}`,
        },
      }),
    onSuccess: () => ok("AI 任务已入队。"),
    onError: (err) => setError(errorMessage(err)),
  })

  const registerAudio = useMutation({
    mutationFn: async (asset: ContentAsset) => {
      if (!asset.entry_id) {
        throw new Error("该素材未关联条目。")
      }

      await adminApi("/admin/content/audio", {
        method: "POST",
        body: {
          site_id: asset.site_id,
          entry_id: asset.entry_id,
          asset_id: asset.id,
          status: "ready",
          metadata: { source: "admin_asset_registration" },
        },
      })

      return adminApi(`/admin/content/entries/${asset.entry_id}`, {
        method: "POST",
        body: { audio_asset_id: asset.id },
      })
    },
    onSuccess: () => ok("音频已登记。"),
    onError: (err) => setError(errorMessage(err)),
  })

  const updateTaskReview = useMutation({
    mutationFn: (input: { taskId: string; reviewStatus: string }) =>
      adminApi(`/admin/content/ai/tasks/${input.taskId}`, {
        method: "POST",
        body: {
          review_status: input.reviewStatus,
          output_summary: `Admin review marked ${input.reviewStatus}`,
        },
      }),
    onSuccess: () => ok("AI 任务复核状态已更新。"),
    onError: (err) => setError(errorMessage(err)),
  })

  const entries = data?.entries || []
  const tasks = data?.tasks || []
  const rowBusy =
    updateStatus.isPending ||
    publishSnapshot.isPending ||
    queueEntryTask.isPending ||
    registerAudio.isPending ||
    updateTaskReview.isPending

  const setEntry = (patch: Partial<typeof EMPTY_ENTRY>) =>
    setEntryForm((current) => ({ ...current, ...patch }))
  const setAsset = (patch: Partial<typeof EMPTY_ASSET>) =>
    setAssetForm((current) => ({ ...current, ...patch }))
  const setAiTask = (patch: Partial<typeof EMPTY_AI_TASK>) =>
    setAiTaskForm((current) => ({ ...current, ...patch }))

  return (
    <main className="px-5 py-5">
      <PageHeader
        title="内容"
        description="管理内容条目、存储、素材与 AI 任务。条目发布走修订快照，全部经由同源 BFF 转发。"
        action={
          <SecondaryButton type="button" onClick={() => void contentQuery.refetch()}>
            刷新
          </SecondaryButton>
        }
      />

      <section className="mb-4 grid gap-3 md:grid-cols-4">
        <MetricCard
          label="已发布"
          value={entries.filter((e) => e.status === "published").length}
          detail="published"
        />
        <MetricCard
          label="待审"
          value={entries.filter((e) => e.status === "review").length}
          detail="review"
        />
        <MetricCard
          label="草稿"
          value={entries.filter((e) => e.status === "draft").length}
          detail="drafts"
        />
        <MetricCard
          label="排队任务"
          value={tasks.filter((task) => task.status === "queued").length}
          detail="queued AI tasks"
        />
      </section>

      <div className="mb-4 grid gap-2">
        {error ? <Message tone="error">{error}</Message> : null}
        {message ? <Message tone="info">{message}</Message> : null}
        {contentQuery.error ? (
          <Message tone="error">{contentQuery.error.message}</Message>
        ) : null}
        {contentQuery.isLoading ? <Message tone="info">加载中</Message> : null}
      </div>

      <div className="grid gap-4">
        <Panel title="新建内容条目">
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              setMessage("")
              void createEntry.mutate()
            }}
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label="site_id">
                <TextInput
                  value={entryForm.siteId}
                  onChange={(event) => setEntry({ siteId: event.target.value })}
                />
              </Field>
              <Field label="标题">
                <TextInput
                  value={entryForm.title}
                  onChange={(event) => {
                    const title = event.target.value
                    setEntryForm((current) => ({
                      ...current,
                      title,
                      slug: current.slug || slugFromTitle(title),
                    }))
                  }}
                />
              </Field>
              <Field label="slug">
                <TextInput
                  value={entryForm.slug}
                  onChange={(event) => setEntry({ slug: event.target.value })}
                />
              </Field>
              <Field label="topic">
                <TextInput
                  value={entryForm.topic}
                  onChange={(event) => setEntry({ topic: event.target.value })}
                />
              </Field>
              <Field label="类型">
                <SelectInput
                  value={entryForm.contentType}
                  onChange={(event) => setEntry({ contentType: event.target.value })}
                >
                  {CONTENT_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="格式">
                <SelectInput
                  value={entryForm.contentFormat}
                  onChange={(event) =>
                    setEntry({ contentFormat: event.target.value })
                  }
                >
                  {CONTENT_FORMAT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="状态">
                <SelectInput
                  value={entryForm.status}
                  onChange={(event) => setEntry({ status: event.target.value })}
                >
                  {CONTENT_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="language">
                <TextInput
                  value={entryForm.language}
                  onChange={(event) => setEntry({ language: event.target.value })}
                />
              </Field>
              <Field label="作者">
                <TextInput
                  value={entryForm.authorName}
                  onChange={(event) => setEntry({ authorName: event.target.value })}
                />
              </Field>
              <Field label="封面图 URL">
                <TextInput
                  value={entryForm.coverImageUrl}
                  onChange={(event) =>
                    setEntry({ coverImageUrl: event.target.value })
                  }
                />
              </Field>
              <Field label="标签（逗号分隔）">
                <TextInput
                  value={entryForm.tags}
                  onChange={(event) => setEntry({ tags: event.target.value })}
                />
              </Field>
              <Field label="关联商品 handle（逗号分隔）">
                <TextInput
                  value={entryForm.relatedProductHandles}
                  onChange={(event) =>
                    setEntry({ relatedProductHandles: event.target.value })
                  }
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <input
                type="checkbox"
                checked={entryForm.aiAssisted}
                onChange={(event) => setEntry({ aiAssisted: event.target.checked })}
              />
              AI 辅助创作
            </label>
            <Field label="摘要">
              <TextAreaInput
                value={entryForm.excerpt}
                onChange={(event) => setEntry({ excerpt: event.target.value })}
              />
            </Field>
            <Field label="正文">
              <TextAreaInput
                className="min-h-48"
                value={entryForm.body}
                onChange={(event) => setEntry({ body: event.target.value })}
              />
            </Field>
            <div>
              <PrimaryButton type="submit" disabled={createEntry.isPending}>
                {createEntry.isPending ? "创建中" : "创建条目"}
              </PrimaryButton>
            </div>
          </form>
        </Panel>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="存储提供方">
            <AdminTable
              headers={["提供方", "Bucket", "策略", "状态"]}
              empty={
                !contentQuery.isLoading &&
                (data?.storage.providers.length || 0) === 0
              }
            >
              {data?.storage.providers.map((provider) => (
                <tr key={provider.code} className="align-top">
                  <Cell>
                    <div className="font-medium">{provider.label}</div>
                    <div className="font-mono text-xs text-[var(--muted)]">
                      {provider.code} / {provider.kind}
                    </div>
                  </Cell>
                  <Cell mono>{provider.bucket || "-"}</Cell>
                  <Cell>{provider.upload_strategy}</Cell>
                  <Cell>
                    <StatusBadge value={provider.status} />
                    {provider.issues.slice(0, 1).map((issue) => (
                      <div
                        key={issue}
                        className="mt-1 max-w-[240px] truncate text-xs text-[var(--danger)]"
                      >
                        {issue}
                      </div>
                    ))}
                  </Cell>
                </tr>
              ))}
            </AdminTable>
          </Panel>

          <Panel title="入队 AI 任务">
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                setMessage("")
                void createAiTask.mutate()
              }}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="site_id">
                  <TextInput
                    value={aiTaskForm.siteId}
                    onChange={(event) => setAiTask({ siteId: event.target.value })}
                  />
                </Field>
                <Field label="entry_id">
                  <TextInput
                    value={aiTaskForm.entryId}
                    onChange={(event) => setAiTask({ entryId: event.target.value })}
                  />
                </Field>
                <Field label="任务类型">
                  <SelectInput
                    value={aiTaskForm.taskType}
                    onChange={(event) =>
                      setAiTask({
                        taskType: event.target.value,
                        providerCapability:
                          TASK_CAPABILITY_DEFAULTS[event.target.value] ||
                          aiTaskForm.providerCapability,
                      })
                    }
                  >
                    {AI_TASK_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="capability">
                  <TextInput
                    value={aiTaskForm.providerCapability}
                    onChange={(event) =>
                      setAiTask({ providerCapability: event.target.value })
                    }
                  />
                </Field>
                <Field label="provider_code">
                  <TextInput
                    value={aiTaskForm.providerCode}
                    onChange={(event) =>
                      setAiTask({ providerCode: event.target.value })
                    }
                  />
                </Field>
                <Field label="model">
                  <TextInput
                    value={aiTaskForm.model}
                    onChange={(event) => setAiTask({ model: event.target.value })}
                  />
                </Field>
              </div>
              <Field label="输入摘要">
                <TextAreaInput
                  value={aiTaskForm.inputSummary}
                  onChange={(event) =>
                    setAiTask({ inputSummary: event.target.value })
                  }
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <PrimaryButton type="submit" disabled={createAiTask.isPending}>
                  {createAiTask.isPending ? "入队中" : "入队任务"}
                </PrimaryButton>
                <SecondaryButton
                  type="button"
                  disabled={runContentAiTask.isPending}
                  onClick={() => {
                    setMessage("")
                    void runContentAiTask.mutate()
                  }}
                >
                  {runContentAiTask.isPending ? "运行中" : "立即运行"}
                </SecondaryButton>
              </div>
            </form>
          </Panel>
        </div>

        <Panel title="素材">
          <form
            className="mb-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              setMessage("")
              void createAsset.mutate()
            }}
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label="site_id">
                <TextInput
                  value={assetForm.siteId}
                  onChange={(event) => setAsset({ siteId: event.target.value })}
                />
              </Field>
              <Field label="entry_id">
                <TextInput
                  value={assetForm.entryId}
                  onChange={(event) => setAsset({ entryId: event.target.value })}
                />
              </Field>
              <Field label="素材类型">
                <SelectInput
                  value={assetForm.assetType}
                  onChange={(event) => setAsset({ assetType: event.target.value })}
                >
                  {ASSET_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="storage_provider_code">
                <TextInput
                  value={assetForm.storageProviderCode}
                  onChange={(event) =>
                    setAsset({ storageProviderCode: event.target.value })
                  }
                />
              </Field>
              <Field label="filename">
                <TextInput
                  value={assetForm.filename}
                  onChange={(event) => setAsset({ filename: event.target.value })}
                />
              </Field>
              <Field label="public_url">
                <TextInput
                  value={assetForm.publicUrl}
                  onChange={(event) => setAsset({ publicUrl: event.target.value })}
                />
              </Field>
              <Field label="object_key">
                <TextInput
                  value={assetForm.objectKey}
                  onChange={(event) => setAsset({ objectKey: event.target.value })}
                />
              </Field>
              <Field label="mime_type">
                <TextInput
                  value={assetForm.mimeType}
                  onChange={(event) => setAsset({ mimeType: event.target.value })}
                />
              </Field>
              <Field label="alt_text">
                <TextInput
                  value={assetForm.altText}
                  onChange={(event) => setAsset({ altText: event.target.value })}
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <PrimaryButton type="submit" disabled={createAsset.isPending}>
                {createAsset.isPending ? "登记中" : "登记素材"}
              </PrimaryButton>
              <SecondaryButton
                type="button"
                disabled={createUploadPolicy.isPending}
                onClick={() => {
                  setMessage("")
                  void createUploadPolicy.mutate()
                }}
              >
                {createUploadPolicy.isPending ? "生成中" : "生成上传策略"}
              </SecondaryButton>
            </div>
          </form>
          {uploadPolicyPreview ? (
            <pre className="mb-4 max-h-56 overflow-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs">
              {uploadPolicyPreview}
            </pre>
          ) : null}
          <AdminTable
            headers={["素材", "entry", "提供方", "URL / key", "操作"]}
            empty={!contentQuery.isLoading && (data?.assets.length || 0) === 0}
          >
            {data?.assets.map((asset) => (
              <tr key={asset.id} className="align-top">
                <Cell>
                  <StatusBadge value={asset.asset_type} />
                  <div className="mt-1 font-mono text-xs text-[var(--muted)]">
                    {asset.id}
                  </div>
                </Cell>
                <Cell mono>{asset.entry_id || "-"}</Cell>
                <Cell mono>
                  {asset.storage_provider_code || asset.storage_provider}
                </Cell>
                <Cell mono>
                  <span className="block max-w-[320px] truncate">
                    {asset.public_url || asset.object_key || "-"}
                  </span>
                </Cell>
                <Cell>
                  {asset.asset_type === "audio" && asset.entry_id ? (
                    <SecondaryButton
                      type="button"
                      disabled={rowBusy}
                      onClick={() => registerAudio.mutate(asset)}
                    >
                      登记音频
                    </SecondaryButton>
                  ) : (
                    "-"
                  )}
                </Cell>
              </tr>
            ))}
          </AdminTable>
        </Panel>

        <Panel title="内容条目">
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <Field label="site_id 过滤">
              <TextInput
                value={filterDraft.siteId}
                onChange={(event) =>
                  setFilterDraft((current) => ({
                    ...current,
                    siteId: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="状态过滤">
              <SelectInput
                value={filterDraft.status}
                onChange={(event) =>
                  setFilterDraft((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
              >
                <option value="">全部</option>
                {CONTENT_STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <SecondaryButton type="button" onClick={() => setFilters(filterDraft)}>
              筛选
            </SecondaryButton>
          </div>
          <AdminTable
            headers={["标题", "site", "类型", "状态", "阅读", "操作"]}
            empty={!contentQuery.isLoading && entries.length === 0}
          >
            {entries.map((entry) => (
              <tr key={entry.id} className="align-top">
                <Cell>
                  <div className="font-medium">{entry.title}</div>
                  <div className="font-mono text-xs text-[var(--muted)]">
                    {entry.slug}
                  </div>
                  <div className="mt-1 max-w-[360px] truncate text-xs text-[var(--muted)]">
                    {entry.excerpt || entry.body || "-"}
                  </div>
                </Cell>
                <Cell mono>{entry.site_id}</Cell>
                <Cell>
                  <div>{entry.content_type}</div>
                  <div className="font-mono text-xs text-[var(--muted)]">
                    {entry.content_format || "plain_text"}
                  </div>
                </Cell>
                <Cell>
                  <StatusBadge value={entry.status} />
                </Cell>
                <Cell>
                  {entry.reading_time_minutes
                    ? `${entry.reading_time_minutes} 分钟`
                    : "-"}
                  <div className="text-xs text-[var(--muted)]">
                    {entry.word_count
                      ? `${entry.word_count} 字`
                      : entry.language || "-"}
                  </div>
                </Cell>
                <Cell>
                  <div className="flex flex-wrap gap-2">
                    <SecondaryButton
                      type="button"
                      disabled={rowBusy}
                      onClick={() => publishSnapshot.mutate(entry)}
                    >
                      发布快照
                    </SecondaryButton>
                    <SecondaryButton
                      type="button"
                      disabled={rowBusy}
                      onClick={() =>
                        queueEntryTask.mutate({
                          entry,
                          taskType: "article_draft",
                        })
                      }
                    >
                      AI 草稿
                    </SecondaryButton>
                    <SecondaryButton
                      type="button"
                      disabled={rowBusy}
                      onClick={() =>
                        queueEntryTask.mutate({ entry, taskType: "tts" })
                      }
                    >
                      TTS
                    </SecondaryButton>
                    {entry.status !== "review" ? (
                      <SecondaryButton
                        type="button"
                        disabled={rowBusy}
                        onClick={() =>
                          updateStatus.mutate({ id: entry.id, status: "review" })
                        }
                      >
                        转待审
                      </SecondaryButton>
                    ) : null}
                    {entry.status !== "archived" ? (
                      <SecondaryButton
                        type="button"
                        disabled={rowBusy}
                        onClick={() =>
                          updateStatus.mutate({ id: entry.id, status: "archived" })
                        }
                      >
                        归档
                      </SecondaryButton>
                    ) : null}
                  </div>
                </Cell>
              </tr>
            ))}
          </AdminTable>
        </Panel>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="音频">
            <CompactRows
              rows={(data?.audio || []).map((item) => ({
                id: item.id,
                title: item.voice || item.model || item.id,
                detail: `${item.entry_id} / ${item.provider_code || "-"}`,
                status: item.status,
                createdAt: item.created_at,
              }))}
              empty={!contentQuery.isLoading && (data?.audio.length || 0) === 0}
            />
          </Panel>
          <Panel title="最近 AI 任务">
            <AdminTable
              headers={["任务", "状态", "复核", "创建", "操作"]}
              empty={!contentQuery.isLoading && tasks.length === 0}
            >
              {tasks.map((task) => (
                <tr key={task.id} className="align-top">
                  <Cell>
                    <div className="font-medium">{task.task_type}</div>
                    <div className="font-mono text-xs text-[var(--muted)]">
                      {task.provider_capability || "-"} / {task.provider_code || "-"}
                    </div>
                  </Cell>
                  <Cell>
                    <StatusBadge value={task.status} />
                  </Cell>
                  <Cell>
                    <StatusBadge value={task.review_status || "pending"} />
                  </Cell>
                  <Cell>{formatDate(task.created_at)}</Cell>
                  <Cell>
                    <div className="flex flex-wrap gap-2">
                      <SecondaryButton
                        type="button"
                        disabled={rowBusy}
                        onClick={() =>
                          updateTaskReview.mutate({
                            taskId: task.id,
                            reviewStatus: "approved",
                          })
                        }
                      >
                        通过
                      </SecondaryButton>
                      <SecondaryButton
                        type="button"
                        disabled={rowBusy}
                        onClick={() =>
                          updateTaskReview.mutate({
                            taskId: task.id,
                            reviewStatus: "needs_changes",
                          })
                        }
                      >
                        需修改
                      </SecondaryButton>
                    </div>
                  </Cell>
                </tr>
              ))}
            </AdminTable>
          </Panel>
        </div>
      </div>
    </main>
  )
}

function CompactRows({
  rows,
  empty,
}: {
  rows: Array<{
    id: string
    title: string
    detail: string
    status: string
    createdAt?: string | null
  }>
  empty: boolean
}) {
  if (empty) {
    return <Message tone="info">暂无数据</Message>
  }

  return (
    <div className="divide-y divide-[var(--border)] rounded-[8px] border border-[var(--border)]">
      {rows.map((row) => (
        <div
          key={row.id}
          className="grid gap-2 px-4 py-3 md:grid-cols-[1fr_auto] md:items-center"
        >
          <div className="min-w-0">
            <div className="font-medium">{row.title}</div>
            <div className="truncate font-mono text-xs text-[var(--muted)]">
              {row.detail}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge value={row.status} />
            <span className="text-xs text-[var(--muted)]">
              {formatDate(row.createdAt)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function AdminTable({
  headers,
  empty,
  children,
}: {
  headers: string[]
  empty: boolean
  children: ReactNode
}) {
  return (
    <>
      <TableShell>
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
              {headers.map((header) => (
                <th
                  key={header}
                  className="border-b border-[var(--border)] py-2 pr-4"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </TableShell>
      {empty ? <Message tone="info">暂无数据</Message> : null}
    </>
  )
}

function Cell({ children, mono }: { children: ReactNode; mono?: boolean }) {
  return (
    <td
      className={
        mono
          ? "border-b border-[var(--border)] py-3 pr-4 font-mono text-xs"
          : "border-b border-[var(--border)] py-3 pr-4"
      }
    >
      {children}
    </td>
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败。"
}
