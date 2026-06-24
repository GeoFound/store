"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"
import { formatDate } from "@/lib/format"
import {
  loadSeoPerformance,
  loadSeoWorkspace,
  suggestSeoDocument,
  type ProductAdminSeoAuditReport,
  type ProductAdminSeoDocument,
  upsertSeoDocument,
} from "@/lib/product-admin-api"
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

const ENTITY_TYPES = [
  "product",
  "content_entry",
  "collection",
  "page",
  "site",
] as const
const STATUSES = ["draft", "review", "published", "archived"] as const

type SeoForm = {
  entityType: string
  entityId: string
  siteId: string
  language: string
  metaTitle: string
  metaDescription: string
  canonicalUrl: string
  ogImageUrl: string
  status: string
}

const EMPTY_FORM: SeoForm = {
  entityType: "page",
  entityId: "",
  siteId: "global",
  language: "",
  metaTitle: "",
  metaDescription: "",
  canonicalUrl: "",
  ogImageUrl: "",
  status: "draft",
}

const EMPTY_SUGGEST_FORM = {
  entityType: "page",
  entityId: "",
  siteId: "global",
  language: "",
  providerCode: "",
  model: "",
}

const EMPTY_AUDIT: ProductAdminSeoAuditReport = {
  summary: { documents: 0, critical: 0, warning: 0, info: 0, averageScore: 100 },
  results: [],
  performanceJoined: false,
}

export function SeoView() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<SeoForm>(EMPTY_FORM)
  const [suggestForm, setSuggestForm] = useState(EMPTY_SUGGEST_FORM)
  const [suggestPreview, setSuggestPreview] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const seoQuery = useQuery({ queryKey: ["seo"], queryFn: loadSeoWorkspace })
  const performanceQuery = useQuery({
    queryKey: ["seo-performance"],
    queryFn: loadSeoPerformance,
  })
  const documents = seoQuery.data?.documents || []
  const audit = seoQuery.data?.audit || EMPTY_AUDIT

  const upsert = useMutation({
    mutationFn: async () => {
      if (!form.entityId.trim()) {
        throw new Error("实体 ID 必填。")
      }

      return upsertSeoDocument(form)
    },
    onSuccess: async () => {
      setMessage("SEO 文档已保存。")
      setError("")
      setForm((current) => ({ ...EMPTY_FORM, siteId: current.siteId }))
      await queryClient.invalidateQueries({ queryKey: ["seo"] })
    },
    onError: (err) => setError(errorMessage(err)),
  })

  const suggestSeo = useMutation({
    mutationFn: async () => {
      if (!suggestForm.entityId.trim()) {
        throw new Error("生成建议需要实体 ID。")
      }

      return suggestSeoDocument(suggestForm)
    },
    onSuccess: (data) => {
      setSuggestPreview(JSON.stringify(data, null, 2))
      setMessage("SEO 建议已生成。")
      setError("")
    },
    onError: (err) => setError(errorMessage(err)),
  })

  function editDocument(doc: ProductAdminSeoDocument) {
    setMessage("")
    setError("")
    setForm({
      entityType: doc.entityType,
      entityId: doc.entityId,
      siteId: doc.siteId || "global",
      language: doc.language === "*" ? "" : doc.language || "",
      metaTitle: doc.metaTitle || "",
      metaDescription: doc.metaDescription || "",
      canonicalUrl: doc.canonicalUrl || "",
      ogImageUrl: doc.ogImageUrl || "",
      status: doc.status,
    })
  }

  const update = (patch: Partial<SeoForm>) =>
    setForm((current) => ({ ...current, ...patch }))
  const updateSuggest = (patch: Partial<typeof EMPTY_SUGGEST_FORM>) =>
    setSuggestForm((current) => ({ ...current, ...patch }))

  const auditFindings = audit.results.filter((result) => result.findings.length)

  return (
    <main className="px-5 py-5">
      <PageHeader
        title="SEO"
        description="管理实体的 SEO 文档（标题、描述、规范链接、OG 图）并查看确定性审计。全部经由同源 BFF 转发。"
        action={
          <SecondaryButton type="button" onClick={() => void seoQuery.refetch()}>
            刷新
          </SecondaryButton>
        }
      />

      <section className="mb-4 grid gap-3 md:grid-cols-4">
        <MetricCard label="文档" value={documents.length} detail="documents" />
        <MetricCard
          label="已发布"
          value={documents.filter((doc) => doc.status === "published").length}
          detail="published"
        />
        <MetricCard label="审计均分" value={audit.summary.averageScore} detail="avg score" />
        <MetricCard
          label="严重问题"
          value={audit.summary.critical}
          detail={`warning ${audit.summary.warning} / info ${audit.summary.info}`}
        />
      </section>

      <div className="mb-4 grid gap-2">
        {error ? <Message tone="error">{error}</Message> : null}
        {message ? <Message tone="info">{message}</Message> : null}
        {seoQuery.error ? (
          <Message tone="error">{seoQuery.error.message}</Message>
        ) : null}
        {performanceQuery.error ? (
          <Message tone="error">{performanceQuery.error.message}</Message>
        ) : null}
        {seoQuery.isLoading ? <Message tone="info">加载中</Message> : null}
      </div>

      <div className="grid gap-4">
        <Panel title="编辑 SEO 文档" description="按 entity 维度 upsert；从下方列表点击“编辑”可载入。">
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              setMessage("")
              void upsert.mutate()
            }}
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label="实体类型">
                <SelectInput
                  value={form.entityType}
                  onChange={(event) => update({ entityType: event.target.value })}
                >
                  {ENTITY_TYPES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="实体 ID">
                <TextInput
                  value={form.entityId}
                  onChange={(event) => update({ entityId: event.target.value })}
                  placeholder="prod_... / 必填"
                />
              </Field>
              <Field label="站点 ID">
                <TextInput
                  value={form.siteId}
                  onChange={(event) => update({ siteId: event.target.value })}
                  placeholder="global"
                />
              </Field>
              <Field label="language（留空=*）">
                <TextInput
                  value={form.language}
                  onChange={(event) => update({ language: event.target.value })}
                  placeholder="*"
                />
              </Field>
              <Field label="SEO 标题">
                <TextInput
                  value={form.metaTitle}
                  onChange={(event) => update({ metaTitle: event.target.value })}
                />
              </Field>
              <Field label="规范链接">
                <TextInput
                  value={form.canonicalUrl}
                  onChange={(event) => update({ canonicalUrl: event.target.value })}
                />
              </Field>
              <Field label="OG 图片链接">
                <TextInput
                  value={form.ogImageUrl}
                  onChange={(event) => update({ ogImageUrl: event.target.value })}
                />
              </Field>
              <Field label="status">
                <SelectInput
                  value={form.status}
                  onChange={(event) => update({ status: event.target.value })}
                >
                  {STATUSES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>
            <Field label="SEO 描述">
              <TextAreaInput
                value={form.metaDescription}
                onChange={(event) =>
                  update({ metaDescription: event.target.value })
                }
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <PrimaryButton type="submit" disabled={upsert.isPending}>
                {upsert.isPending ? "保存中" : "保存 SEO 文档"}
              </PrimaryButton>
              <SecondaryButton type="button" onClick={() => setForm(EMPTY_FORM)}>
                清空
              </SecondaryButton>
            </div>
          </form>
        </Panel>

        <Panel
          title="SEO 审计"
          description={
            audit.performanceJoined
              ? "已联接 GSC 性能数据。"
              : "确定性审计结果。"
          }
        >
          <AdminTable
            headers={["实体", "评分", "问题"]}
            empty={!seoQuery.isLoading && auditFindings.length === 0}
          >
            {auditFindings.map((result) => (
              <tr key={result.id} className="align-top">
                <Cell>
                  <div className="font-medium">{result.entityType}</div>
                  <div className="font-mono text-xs text-[var(--muted)]">
                    {result.entityId}
                  </div>
                </Cell>
                <Cell>{result.score}</Cell>
                <Cell>
                  <div className="grid gap-1">
                    {result.findings.map((finding) => (
                      <div key={finding.id} className="flex items-start gap-2">
                        <SeverityTag severity={finding.severity} />
                        <span className="text-[var(--muted)]">
                          {finding.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </Cell>
              </tr>
            ))}
          </AdminTable>
        </Panel>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel
            title="Search Console 性能"
            description={
              performanceQuery.data?.performance?.configured === false
                ? "Search Console 未配置，性能联接会安全降级。"
                : "最近页面维度性能数据。"
            }
          >
            {performanceQuery.isLoading ? <Message tone="info">加载中</Message> : null}
            {performanceQuery.data?.error ? (
              <Message tone="error">{performanceQuery.data.error}</Message>
            ) : null}
            <AdminTable
              headers={["维度", "点击", "展示", "CTR / Position"]}
              empty={
                !performanceQuery.isLoading &&
                (performanceQuery.data?.performance?.rows?.length || 0) === 0
              }
            >
              {(performanceQuery.data?.performance?.rows || []).map((row, index) => (
                <tr key={index} className="align-top">
                  <Cell>{String(row.keys || row.page || row.query || "-")}</Cell>
                  <Cell>{String(row.clicks ?? "-")}</Cell>
                  <Cell>{String(row.impressions ?? "-")}</Cell>
                  <Cell>
                    {String(row.ctr ?? "-")} / {String(row.position ?? "-")}
                  </Cell>
                </tr>
              ))}
            </AdminTable>
          </Panel>

          <Panel title="生成 SEO 建议">
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                setMessage("")
                void suggestSeo.mutate()
              }}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="实体类型">
                  <SelectInput
                    value={suggestForm.entityType}
                    onChange={(event) =>
                      updateSuggest({ entityType: event.target.value })
                    }
                  >
                    {ENTITY_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="实体 ID">
                  <TextInput
                    value={suggestForm.entityId}
                    onChange={(event) =>
                      updateSuggest({ entityId: event.target.value })
                    }
                  />
                </Field>
                <Field label="站点 ID">
                  <TextInput
                    value={suggestForm.siteId}
                    onChange={(event) =>
                      updateSuggest({ siteId: event.target.value })
                    }
                  />
                </Field>
                <Field label="language">
                  <TextInput
                    value={suggestForm.language}
                    onChange={(event) =>
                      updateSuggest({ language: event.target.value })
                    }
                  />
                </Field>
                <Field label="供应商代码">
                  <TextInput
                    value={suggestForm.providerCode}
                    onChange={(event) =>
                      updateSuggest({ providerCode: event.target.value })
                    }
                  />
                </Field>
                <Field label="model">
                  <TextInput
                    value={suggestForm.model}
                    onChange={(event) => updateSuggest({ model: event.target.value })}
                  />
                </Field>
              </div>
              <PrimaryButton type="submit" disabled={suggestSeo.isPending}>
                {suggestSeo.isPending ? "生成中" : "生成建议"}
              </PrimaryButton>
            </form>
            {suggestPreview ? (
              <pre className="mt-4 max-h-72 overflow-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs">
                {suggestPreview}
              </pre>
            ) : null}
          </Panel>
        </div>

        <Panel title="SEO 文档">
          <AdminTable
            headers={["实体", "范围", "SEO 标题", "状态", "更新时间", "操作"]}
            empty={!seoQuery.isLoading && documents.length === 0}
          >
            {documents.map((doc) => (
              <tr key={doc.id} className="align-top">
                <Cell>
                  <div className="font-medium">{doc.entityType}</div>
                  <div className="font-mono text-xs text-[var(--muted)]">
                    {doc.entityId}
                  </div>
                </Cell>
                <Cell mono>
                  {doc.siteId} · {doc.language}
                </Cell>
                <Cell>
                  <span className="block max-w-[280px] truncate">
                    {doc.metaTitle || "-"}
                  </span>
                </Cell>
                <Cell>
                  <StatusBadge value={doc.status} />
                </Cell>
                <Cell>{formatDate(doc.updatedAt)}</Cell>
                <Cell>
                  <SecondaryButton type="button" onClick={() => editDocument(doc)}>
                    编辑
                  </SecondaryButton>
                </Cell>
              </tr>
            ))}
          </AdminTable>
        </Panel>
      </div>
    </main>
  )
}

function SeverityTag({ severity }: { severity: string }) {
  const tone =
    severity === "critical"
      ? "border-red-200 bg-red-50 text-[var(--danger)]"
      : severity === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-50 text-[var(--muted)]"

  return (
    <span
      className={`shrink-0 rounded-[4px] border px-1.5 py-0.5 text-xs font-medium ${tone}`}
    >
      {severity}
    </span>
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败。"
}
