import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Heading, Table, Text, Textarea } from "@medusajs/ui"
import { FormEvent, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { AdminSection } from "../../components/admin-section"
import { LocalizedStatusSelect } from "../../components/localized-status-select"
import { MessageBox } from "../../components/message-box"
import { adminApi, formatDate } from "../../lib/admin-api"
import { translatedStatus } from "../../lib/i18n"

type AfterSale = {
  id: string
  delivery_id: string
  customer_email?: string | null
  reason: string
  message: string
  status: string
  result: string
  admin_note?: string | null
  handled_by?: string | null
  handled_at?: string | null
  created_at?: string
}

const AFTER_SALES_STATUS_OPTIONS = [
  "open",
  "processing",
  "resolved",
  "rejected",
  "closed",
] as const

const AFTER_SALES_RESULT_OPTIONS = [
  "pending",
  "replaced",
  "refunded",
  "rejected",
  "resolved",
] as const

const AfterSalesPage = () => {
  const { t } = useTranslation()
  const [afterSales, setAfterSales] = useState<AfterSale[]>([])
  const [selected, setSelected] = useState<AfterSale | null>(null)
  const [status, setStatus] = useState("processing")
  const [result, setResult] = useState("pending")
  const [adminNote, setAdminNote] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    const data = await adminApi<{ after_sales: AfterSale[] }>("/admin/after-sales")
    setAfterSales(data.after_sales)
  }

  function selectAfterSale(item: AfterSale) {
    setSelected(item)
    setStatus(item.status)
    setResult(item.result)
    setAdminNote(item.admin_note || "")
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selected) {
      return
    }

    setLoading(true)
    setError("")
    setMessage("")

    try {
      await adminApi(`/admin/after-sales/${selected.id}`, {
        method: "POST",
        body: {
          status,
          result,
          admin_note: adminNote,
        },
      })
      setMessage(t("afterSales.updated"))
      setSelected(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("afterSales.updateFailed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-4">
      <AdminSection
        title={t("afterSales.title")}
        description={t("afterSales.description")}
      >
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{t("common.fields.request")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.status")}</Table.HeaderCell>
              <Table.HeaderCell>{t("afterSales.reason")}</Table.HeaderCell>
              <Table.HeaderCell>{t("afterSales.message")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.created")}</Table.HeaderCell>
              <Table.HeaderCell></Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {afterSales.map((item) => (
              <Table.Row key={item.id}>
                <Table.Cell>
                  <div>
                    <Heading level="h3" className="font-mono">
                      {item.id}
                    </Heading>
                    <Text className="text-ui-fg-subtle">{item.customer_email || "-"}</Text>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Badge>{translatedStatus(t, item.status)}</Badge>
                </Table.Cell>
                <Table.Cell>{item.reason}</Table.Cell>
                <Table.Cell className="max-w-[360px] truncate">{item.message}</Table.Cell>
                <Table.Cell>{formatDate(item.created_at)}</Table.Cell>
                <Table.Cell>
                  <Button variant="secondary" onClick={() => selectAfterSale(item)}>
                    {t("afterSales.handle")}
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </AdminSection>

      <AdminSection title={t("afterSales.handleRequest")}>
        {selected ? (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <Text className="font-mono">{selected.id}</Text>
            <div className="grid gap-4 md:grid-cols-2">
              <LocalizedStatusSelect
                value={status}
                onValueChange={setStatus}
                options={AFTER_SALES_STATUS_OPTIONS}
              />
              <LocalizedStatusSelect
                value={result}
                onValueChange={setResult}
                options={AFTER_SALES_RESULT_OPTIONS}
                placeholder={t("common.fields.result")}
              />
            </div>
            <Textarea
              value={adminNote}
              onChange={(event) => setAdminNote(event.target.value)}
              placeholder={t("afterSales.adminNotePlaceholder")}
            />
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? t("afterSales.saving") : t("afterSales.saveResult")}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setSelected(null)}>
                {t("common.actions.cancel")}
              </Button>
            </div>
            <MessageBox error={error} success={message} />
          </form>
        ) : (
          <Text className="text-ui-fg-subtle">{t("afterSales.selectRequest")}</Text>
        )}
      </AdminSection>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "adminRoutes.afterSales",
  translationNs: "translation",
  rank: 22,
})

export default AfterSalesPage
