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

type SeoDocument = {
  id: string
  entity_type: string
  entity_id: string
  site_id: string
  language: string
  meta_title: string | null
  meta_description: string | null
  canonical_url: string | null
  og_image_url: string | null
  status: string
  updated_at: string | null
}

type SeoAuditFinding = {
  id: string
  severity: string
  field: string
  message: string
}

type SeoAuditResult = {
  id: string
  entity_type: string
  entity_id: string
  score: number
  findings: SeoAuditFinding[]
}

type SeoAuditReport = {
  summary: {
    documents: number
    critical: number
    warning: number
    info: number
    average_score: number
  }
  results: SeoAuditResult[]
  performance_joined?: boolean
}

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

const EMPTY_AUDIT: SeoAuditReport = {
  summary: { documents: 0, critical: 0, warning: 0, info: 0, average_score: 100 },
  results: [],
  performance_joined: false,
}

async function loadSeo() {
  const [documentsData, auditData] = await Promise.all([
    adminApi<{ documents: SeoDocument[] }>("/admin/content/seo?limit=200"),
    adminApi<SeoAuditReport>("/admin/content/seo/audit").catch(() => EMPTY_AUDIT),
  ])

  return {
    documents: documentsData.documents || [],
    audit: auditData || EMPTY_AUDIT,
  }
}

export function SeoView() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<SeoForm>(EMPTY_FORM)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const seoQuery = useQuery({ queryKey: ["seo"], queryFn: loadSeo })
  const documents = seoQuery.data?.documents || []
  const audit = seoQuery.data?.audit || EMPTY_AUDIT

  const upsert = useMutation({
    mutationFn: async () => {
      if (!form.entityId.trim()) {
        throw new Error("entity_id 必填。")
      }

      return adminApi("/admin/content/seo", {
        method: "POST",
        body: {
          entity_type: form.entityType,
          entity_id: form.entityId.trim(),
          site_id: form.siteId.trim() || null,
          language: form.language.trim() || null,
          meta_title: form.metaTitle.trim() || null,
          meta_description: form.metaDescription.trim() || null,
          canonical_url: form.canonicalUrl.trim() || null,
          og_image_url: form.ogImageUrl.trim() || null,
          status: form.status,
        },
      })
    },
    onSuccess: async () => {
      setMessage("SEO 文档已保存。")
      setError("")
      setForm((current) => ({ ...EMPTY_FORM, siteId: current.siteId }))
      await queryClient.invalidateQueries({ queryKey: ["seo"] })
    },
    onError: (err) => setError(errorMessage(err)),
  })

  function editDocument(doc: SeoDocument) {
    setMessage("")
    setError("")
    setForm({
      entityType: doc.entity_type,
      entityId: doc.entity_id,
      siteId: doc.site_id || "global",
      language: doc.language === "*" ? "" : doc.language || "",
      metaTitle: doc.meta_title || "",
      metaDescription: doc.meta_description || "",
      canonicalUrl: doc.canonical_url || "",
      ogImageUrl: doc.og_image_url || "",
      status: doc.status,
    })
  }

  const update = (patch: Partial<SeoForm>) =>
    setForm((current) => ({ ...current, ...patch }))

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
        <MetricCard label="审计均分" value={audit.summary.average_score} detail="avg score" />
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
              <Field label="entity_type">
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
              <Field label="entity_id">
                <TextInput
                  value={form.entityId}
                  onChange={(event) => update({ entityId: event.target.value })}
                  placeholder="prod_... / 必填"
                />
              </Field>
              <Field label="site_id">
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
              <Field label="meta_title">
                <TextInput
                  value={form.metaTitle}
                  onChange={(event) => update({ metaTitle: event.target.value })}
                />
              </Field>
              <Field label="canonical_url">
                <TextInput
                  value={form.canonicalUrl}
                  onChange={(event) => update({ canonicalUrl: event.target.value })}
                />
              </Field>
              <Field label="og_image_url">
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
            <Field label="meta_description">
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
            audit.performance_joined
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
                  <div className="font-medium">{result.entity_type}</div>
                  <div className="font-mono text-xs text-[var(--muted)]">
                    {result.entity_id}
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

        <Panel title="SEO 文档">
          <AdminTable
            headers={["实体", "范围", "meta_title", "状态", "更新时间", "操作"]}
            empty={!seoQuery.isLoading && documents.length === 0}
          >
            {documents.map((doc) => (
              <tr key={doc.id} className="align-top">
                <Cell>
                  <div className="font-medium">{doc.entity_type}</div>
                  <div className="font-mono text-xs text-[var(--muted)]">
                    {doc.entity_id}
                  </div>
                </Cell>
                <Cell mono>
                  {doc.site_id} · {doc.language}
                </Cell>
                <Cell>
                  <span className="block max-w-[280px] truncate">
                    {doc.meta_title || "-"}
                  </span>
                </Cell>
                <Cell>
                  <StatusBadge value={doc.status} />
                </Cell>
                <Cell>{formatDate(doc.updated_at)}</Cell>
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
