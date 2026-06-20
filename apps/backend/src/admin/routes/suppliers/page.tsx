import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Input, Table, Text, Textarea } from "@medusajs/ui"
import { FormEvent, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { AdminSection } from "../../components/admin-section"
import { MessageBox } from "../../components/message-box"
import { adminApi, formatDate } from "../../lib/admin-api"
import { translatedStatus } from "../../lib/i18n"

type SupplierProvider = {
  code: string
  configured: boolean
  supports_quote: boolean
  supports_retrieve: boolean
  supports_catalog_sync: boolean
}

type SupplierMapping = {
  id: string
  product_variant_id: string
  provider_code: string
  provider_sku: string
  provider_product_id?: string | null
  region_code?: string | null
  currency?: string | null
  enabled: boolean
  priority: number
}

type SupplierProcurement = {
  id: string
  provider_code: string
  provider_order_id?: string | null
  status: string
  product_variant_id?: string | null
  order_id?: string | null
  payment_attempt_id?: string | null
  error_message?: string | null
  fulfilled_at?: string | null
  created_at?: string | null
}

const SuppliersPage = () => {
  const { t } = useTranslation()
  const [providers, setProviders] = useState<SupplierProvider[]>([])
  const [mappings, setMappings] = useState<SupplierMapping[]>([])
  const [procurements, setProcurements] = useState<SupplierProcurement[]>([])
  const [form, setForm] = useState({
    productVariantId: "",
    providerCode: "reloadly",
    providerSku: "",
    providerProductId: "",
    regionCode: "",
    currency: "",
    priority: "100",
    metadata: "",
  })
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    const [providerData, mappingData, procurementData] = await Promise.all([
      adminApi<{ providers: SupplierProvider[] }>("/admin/suppliers/providers"),
      adminApi<{ mappings: SupplierMapping[] }>("/admin/suppliers/mappings"),
      adminApi<{ procurements: SupplierProcurement[] }>(
        "/admin/suppliers/procurements"
      ),
    ])
    setProviders(providerData.providers)
    setMappings(mappingData.mappings)
    setProcurements(procurementData.procurements)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    try {
      const metadata = parseMetadata(form.metadata)
      const result = await adminApi<{ mapping: SupplierMapping }>(
        "/admin/suppliers/mappings",
        {
          method: "POST",
          body: {
            product_variant_id: form.productVariantId,
            provider_code: form.providerCode,
            provider_sku: form.providerSku,
            provider_product_id: form.providerProductId || undefined,
            region_code: form.regionCode || undefined,
            currency: form.currency || undefined,
            priority: Number(form.priority) || 100,
            enabled: true,
            metadata,
          },
        }
      )
      setMessage(t("suppliers.mappingSaved", { id: result.mapping.id }))
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("suppliers.failedMapping"))
    } finally {
      setLoading(false)
    }
  }

  async function retryProcurement(id: string) {
    setLoading(true)
    setError("")
    setMessage("")

    try {
      await adminApi(`/admin/suppliers/procurements/${id}/retry`, {
        method: "POST",
      })
      setMessage(t("suppliers.retrySubmitted", { id }))
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("suppliers.failedRetry"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-4">
      <AdminSection title={t("suppliers.providers")}>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{t("common.fields.provider")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.configured")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.capabilities")}</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {providers.map((provider) => (
              <Table.Row key={provider.code}>
                <Table.Cell className="font-mono">{provider.code}</Table.Cell>
                <Table.Cell>
                  <Badge color={provider.configured ? "green" : "orange"}>
                    {provider.configured
                      ? t("common.states.configured")
                      : t("common.states.missingEnv")}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-ui-fg-subtle">
                    {[
                      provider.supports_quote ? "quote" : null,
                      provider.supports_retrieve ? "retrieve" : null,
                      provider.supports_catalog_sync ? "catalog" : null,
                    ]
                      .filter(Boolean)
                      .join(" / ") || "-"}
                  </Text>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </AdminSection>

      <AdminSection title={t("suppliers.variantMapping")}>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              value={form.productVariantId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  productVariantId: event.target.value,
                }))
              }
              placeholder="product_variant_id"
            />
            <Input
              value={form.providerCode}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  providerCode: event.target.value,
                }))
              }
              placeholder={t("suppliers.providerCode")}
            />
            <Input
              value={form.providerSku}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  providerSku: event.target.value,
                }))
              }
              placeholder={t("suppliers.providerSku")}
            />
            <Input
              value={form.providerProductId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  providerProductId: event.target.value,
                }))
              }
              placeholder={t("suppliers.providerProductId")}
            />
            <Input
              value={form.regionCode}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  regionCode: event.target.value,
                }))
              }
              placeholder={t("suppliers.regionCode")}
            />
            <Input
              value={form.currency}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  currency: event.target.value,
                }))
              }
              placeholder={t("suppliers.currency")}
            />
            <Input
              value={form.priority}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  priority: event.target.value,
                }))
              }
              placeholder={t("suppliers.priority")}
            />
          </div>
          <Textarea
            value={form.metadata}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                metadata: event.target.value,
              }))
            }
            placeholder={t("suppliers.metadataPlaceholder")}
          />
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? t("suppliers.saving") : t("suppliers.saveMapping")}
            </Button>
            <Button type="button" variant="secondary" onClick={refresh}>
              {t("common.actions.refresh")}
            </Button>
          </div>
          <MessageBox error={error} success={message} />
        </form>
      </AdminSection>

      <AdminSection title={t("suppliers.mappings")}>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{t("common.fields.variant")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.provider")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.sku")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.region")}</Table.HeaderCell>
              <Table.HeaderCell>{t("suppliers.priority")}</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {mappings.map((mapping) => (
              <Table.Row key={mapping.id}>
                <Table.Cell className="font-mono">
                  {mapping.product_variant_id}
                </Table.Cell>
                <Table.Cell className="font-mono">
                  {mapping.provider_code}
                </Table.Cell>
                <Table.Cell className="font-mono">{mapping.provider_sku}</Table.Cell>
                <Table.Cell>{mapping.region_code || "-"}</Table.Cell>
                <Table.Cell>{mapping.priority}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </AdminSection>

      <AdminSection title={t("suppliers.procurements")}>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{t("common.fields.id")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.status")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.provider")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.order")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.created")}</Table.HeaderCell>
              <Table.HeaderCell></Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {procurements.map((procurement) => (
              <Table.Row key={procurement.id}>
                <Table.Cell className="font-mono">{procurement.id}</Table.Cell>
                <Table.Cell>
                  <Badge>{translatedStatus(t, procurement.status)}</Badge>
                </Table.Cell>
                <Table.Cell className="font-mono">
                  {procurement.provider_code}
                </Table.Cell>
                <Table.Cell className="font-mono">
                  {procurement.order_id || procurement.payment_attempt_id || "-"}
                </Table.Cell>
                <Table.Cell>{formatDate(procurement.created_at)}</Table.Cell>
                <Table.Cell>
                  <Button
                    variant="secondary"
                    disabled={loading || procurement.status === "fulfilled"}
                    onClick={() => retryProcurement(procurement.id)}
                  >
                    {t("common.actions.retry")}
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </AdminSection>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "adminRoutes.suppliers",
  translationNs: "translation",
  rank: 22,
})

export default SuppliersPage

function parseMetadata(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return undefined
  }

  return JSON.parse(trimmed) as Record<string, unknown>
}
