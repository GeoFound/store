import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Select,
  Table,
  Text,
  Textarea,
} from "@medusajs/ui"
import { FormEvent, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { AdminSection } from "../../components/admin-section"
import { LocalizedStatusSelect } from "../../components/localized-status-select"
import { MessageBox } from "../../components/message-box"
import { adminApi, formatDate } from "../../lib/admin-api"
import { translatedStatus } from "../../lib/i18n"

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

const SeoPage = () => {
  const { t } = useTranslation()
  const [documents, setDocuments] = useState<SeoDocument[]>([])
  const [form, setForm] = useState<SeoForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    void refresh()
  }, [])

  const metrics = useMemo(() => {
    const published = documents.filter((doc) => doc.status === "published").length
    const drafts = documents.filter((doc) => doc.status === "draft").length
    return [
      { label: t("seo.metrics.total"), value: documents.length },
      { label: t("seo.metrics.published"), value: published },
      { label: t("seo.metrics.drafts"), value: drafts },
    ]
  }, [documents, t])

  async function refresh() {
    setError("")
    setLoading(true)

    try {
      const data = await adminApi<{ documents: SeoDocument[] }>(
        "/admin/content/seo?limit=200"
      )
      setDocuments(data.documents || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t("seo.loadFailed"))
    } finally {
      setLoading(false)
    }
  }

  async function upsert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError("")
    setMessage("")

    try {
      await adminApi("/admin/content/seo", {
        method: "POST",
        body: {
          entity_type: form.entityType,
          entity_id: form.entityId,
          site_id: form.siteId || null,
          language: form.language || null,
          meta_title: form.metaTitle || null,
          meta_description: form.metaDescription || null,
          canonical_url: form.canonicalUrl || null,
          og_image_url: form.ogImageUrl || null,
          status: form.status,
        },
      })
      setMessage(t("seo.saved"))
      setForm((current) => ({ ...EMPTY_FORM, siteId: current.siteId }))
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("seo.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  function editDocument(doc: SeoDocument) {
    setMessage("")
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

  return (
    <div className="flex flex-col gap-y-4">
      <Container className="p-0">
        <div className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-[780px]">
            <Heading level="h1">{t("seo.title")}</Heading>
            <Text className="mt-2 text-ui-fg-subtle">{t("seo.description")}</Text>
          </div>
          <Button onClick={refresh} disabled={loading}>
            {loading ? t("seo.refreshing") : t("common.actions.refresh")}
          </Button>
        </div>
      </Container>

      <div className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <Container key={metric.label} className="p-0">
            <div className="px-5 py-4">
              <Text className="text-ui-fg-subtle">{metric.label}</Text>
              <Heading level="h2" className="mt-2">
                {metric.value}
              </Heading>
            </div>
          </Container>
        ))}
      </div>

      <MessageBox error={error} success={message} />

      <AdminSection title={t("seo.form.title")} description={t("seo.form.description")}>
        <form className="flex flex-col gap-4" onSubmit={upsert}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label={t("seo.form.entityType")}>
              <Select
                value={form.entityType}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, entityType: value }))
                }
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {ENTITY_TYPES.map((option) => (
                    <Select.Item key={option} value={option}>
                      {t(`seo.entityTypes.${option}`)}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </Field>
            <Field label={t("seo.form.entityId")}>
              <Input
                value={form.entityId}
                required
                onChange={(event) =>
                  setForm((current) => ({ ...current, entityId: event.target.value }))
                }
              />
            </Field>
            <Field label={t("seo.form.siteId")}>
              <Input
                value={form.siteId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, siteId: event.target.value }))
                }
              />
            </Field>
            <Field label={t("seo.form.language")}>
              <Input
                value={form.language}
                placeholder="*"
                onChange={(event) =>
                  setForm((current) => ({ ...current, language: event.target.value }))
                }
              />
            </Field>
            <Field label={t("seo.form.metaTitle")}>
              <Input
                value={form.metaTitle}
                onChange={(event) =>
                  setForm((current) => ({ ...current, metaTitle: event.target.value }))
                }
              />
            </Field>
            <Field label={t("seo.form.canonicalUrl")}>
              <Input
                value={form.canonicalUrl}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    canonicalUrl: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label={t("seo.form.ogImageUrl")}>
              <Input
                value={form.ogImageUrl}
                onChange={(event) =>
                  setForm((current) => ({ ...current, ogImageUrl: event.target.value }))
                }
              />
            </Field>
            <Field label={t("common.fields.status")}>
              <LocalizedStatusSelect
                value={form.status}
                options={STATUSES}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, status: value }))
                }
              />
            </Field>
          </div>
          <Field label={t("seo.form.metaDescription")}>
            <Textarea
              value={form.metaDescription}
              rows={3}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  metaDescription: event.target.value,
                }))
              }
            />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" isLoading={saving} disabled={saving}>
              {t("seo.form.submit")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setForm(EMPTY_FORM)}
              disabled={saving}
            >
              {t("common.actions.clear")}
            </Button>
          </div>
        </form>
      </AdminSection>

      <AdminSection
        title={t("seo.documents.title")}
        description={t("seo.documents.description")}
      >
        {documents.length === 0 ? (
          <Text className="text-ui-fg-subtle">{t("seo.documents.empty")}</Text>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{t("seo.fields.entity")}</Table.HeaderCell>
                <Table.HeaderCell>{t("seo.fields.scope")}</Table.HeaderCell>
                <Table.HeaderCell>{t("seo.fields.metaTitle")}</Table.HeaderCell>
                <Table.HeaderCell>{t("common.fields.status")}</Table.HeaderCell>
                <Table.HeaderCell>{t("seo.fields.updated")}</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {documents.map((doc) => (
                <Table.Row key={doc.id}>
                  <Table.Cell>
                    <div className="min-w-0">
                      <Text className="truncate" weight="plus">
                        {t(`seo.entityTypes.${doc.entity_type}`, doc.entity_type)}
                      </Text>
                      <Text className="font-mono text-xs text-ui-fg-subtle">
                        {doc.entity_id}
                      </Text>
                    </div>
                  </Table.Cell>
                  <Table.Cell className="font-mono text-xs">
                    {doc.site_id} · {doc.language}
                  </Table.Cell>
                  <Table.Cell className="max-w-[280px] truncate">
                    {doc.meta_title || "-"}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge size="2xsmall">{translatedStatus(t, doc.status)}</Badge>
                  </Table.Cell>
                  <Table.Cell className="text-xs text-ui-fg-subtle">
                    {formatDate(doc.updated_at)}
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={() => editDocument(doc)}
                    >
                      {t("common.actions.edit")}
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </AdminSection>
    </div>
  )
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <Text size="small" leading="compact" weight="plus">
        {props.label}
      </Text>
      {props.children}
    </label>
  )
}

export const config = defineRouteConfig({
  label: "adminRoutes.seo",
  translationNs: "translation",
  rank: 29,
})

export default SeoPage
