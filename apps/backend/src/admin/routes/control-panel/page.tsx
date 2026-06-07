import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Text } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { AdminLanguageSwitcher } from "../../components/language-switcher"
import { adminApi, formatDate } from "../../lib/admin-api"
import { translatedStatus } from "../../lib/i18n"

type PaymentChannel = {
  id: string
  code: string
  display_name: string
  enabled: boolean
  health_status: string
  provider_code: string
}

type PaymentAttempt = {
  id: string
  amount: number
  currency: string
  provider_code: string
  status: string
  created_at?: string | null
}

type CredentialBatch = {
  id: string
  name: string
  status: string
  total_count: number
  available_count: number
  reserved_count: number
  sold_count: number
}

type PendingDeliveryItem = {
  id: string
  display_label: string
  product_variant_id: string
  order_id?: string | null
  cart_id?: string | null
  payment_attempt_id?: string | null
  created_at?: string | null
}

type AuditLog = {
  id: string
  action: string
  actor_type: string
  entity_type: string
  entity_id?: string | null
  risk_level: string
  created_at?: string | null
}

type CatalogVariant = {
  id: string
  title: string | null
  sku: string | null
  product_title: string | null
  product_handle: string | null
  template_title: string
  inventory_handler_code: string
  delivery_handler_code: string | null
  credential_inventory_supported: boolean
  available_count: number | null
}

type SupplierProcurement = {
  id: string
  provider_code: string
  status: string
  product_variant_id?: string | null
  order_id?: string | null
  created_at?: string | null
}

type AfterSale = {
  id: string
  status: string
  reason: string
  customer_email?: string | null
  created_at?: string | null
}

type ControlPanelState = {
  afterSales: AfterSale[]
  auditLogs: AuditLog[]
  batches: CredentialBatch[]
  channels: PaymentChannel[]
  catalogVariants: CatalogVariant[]
  paymentAttempts: PaymentAttempt[]
  pendingDeliveries: PendingDeliveryItem[]
  supplierProcurements: SupplierProcurement[]
}

const EMPTY_STATE: ControlPanelState = {
  afterSales: [],
  auditLogs: [],
  batches: [],
  channels: [],
  catalogVariants: [],
  paymentAttempts: [],
  pendingDeliveries: [],
  supplierProcurements: [],
}

const workflowLinks = [
  {
    bodyKey: "controlPanel.links.productPublishing.body",
    commandKey: "controlPanel.links.productPublishing.command",
    titleKey: "controlPanel.links.productPublishing.title",
    to: "/product-publishing",
  },
  {
    bodyKey: "controlPanel.links.orders.body",
    commandKey: "controlPanel.links.orders.command",
    titleKey: "controlPanel.links.orders.title",
    to: "/orders",
  },
  {
    bodyKey: "controlPanel.links.products.body",
    commandKey: "controlPanel.links.products.command",
    titleKey: "controlPanel.links.products.title",
    to: "/products",
  },
  {
    bodyKey: "controlPanel.links.payments.body",
    commandKey: "controlPanel.links.payments.command",
    titleKey: "controlPanel.links.payments.title",
    to: "/payments",
  },
  {
    bodyKey: "controlPanel.links.deliveries.body",
    commandKey: "controlPanel.links.deliveries.command",
    titleKey: "controlPanel.links.deliveries.title",
    to: "/deliveries",
  },
  {
    bodyKey: "controlPanel.links.credentials.body",
    commandKey: "controlPanel.links.credentials.command",
    titleKey: "controlPanel.links.credentials.title",
    to: "/credentials",
  },
  {
    bodyKey: "controlPanel.links.suppliers.body",
    commandKey: "controlPanel.links.suppliers.command",
    titleKey: "controlPanel.links.suppliers.title",
    to: "/suppliers",
  },
  {
    bodyKey: "controlPanel.links.afterSales.body",
    commandKey: "controlPanel.links.afterSales.command",
    titleKey: "controlPanel.links.afterSales.title",
    to: "/after-sales",
  },
  {
    bodyKey: "controlPanel.links.audit.body",
    commandKey: "controlPanel.links.audit.command",
    titleKey: "controlPanel.links.audit.title",
    to: "/audit-logs",
  },
]

const ControlPanelPage = () => {
  const { t } = useTranslation()
  const [dashboard, setDashboard] = useState<ControlPanelState>(EMPTY_STATE)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void refresh()
  }, [])

  const metrics = useMemo(() => {
    const enabledChannels = dashboard.channels.filter(
      (channel) => channel.enabled
    ).length
    const unhealthyChannels = dashboard.channels.filter((channel) => {
      if (!channel.enabled) {
        return false
      }

      return !["configured", "healthy", "active"].includes(
        channel.health_status
      )
    }).length
    const paymentAttentionCount = dashboard.paymentAttempts.filter(
      (attempt) => !["paid", "refunded"].includes(attempt.status)
    ).length
    const pendingDeliveryCount = dashboard.pendingDeliveries.length
    const availableCredentials = sumBy(
      dashboard.batches,
      (batch) => batch.available_count
    )
    const reservedCredentials = sumBy(
      dashboard.batches,
      (batch) => batch.reserved_count
    )
    const highRiskEvents = dashboard.auditLogs.filter(
      (log) => log.risk_level === "high"
    ).length
    const publishNeedsAction = dashboard.catalogVariants.filter((variant) => {
      if (variant.credential_inventory_supported) {
        return (variant.available_count || 0) <= 0
      }

      return !variant.delivery_handler_code
    }).length
    const supplierAttention = dashboard.supplierProcurements.filter((item) =>
      ["failed", "needs_review"].includes(item.status)
    ).length
    const openAfterSales = dashboard.afterSales.filter((item) =>
      ["open", "processing"].includes(item.status)
    ).length

    return [
      {
        body: t("controlPanel.metrics.catalog.body"),
        detail: t("controlPanel.metrics.catalog.detail", {
          count: dashboard.catalogVariants.length,
        }),
        label: t("controlPanel.metrics.catalog.label"),
        to: "/product-publishing",
        value: publishNeedsAction,
      },
      {
        body: t("controlPanel.metrics.pendingDeliveries.body"),
        detail: t("controlPanel.metrics.pendingDeliveries.detail"),
        label: t("controlPanel.metrics.pendingDeliveries.label"),
        to: "/deliveries",
        value: pendingDeliveryCount,
      },
      {
        body: t("controlPanel.metrics.paymentAttention.body"),
        detail: t("controlPanel.metrics.paymentAttention.detail", {
          count: dashboard.paymentAttempts.length,
        }),
        label: t("controlPanel.metrics.paymentAttention.label"),
        to: "/payments",
        value: paymentAttentionCount,
      },
      {
        body: t("controlPanel.metrics.credentials.body"),
        detail: t("controlPanel.metrics.credentials.detail", {
          reserved: reservedCredentials,
        }),
        label: t("controlPanel.metrics.credentials.label"),
        to: "/credentials",
        value: availableCredentials,
      },
      {
        body: t("controlPanel.metrics.suppliers.body"),
        detail: t("controlPanel.metrics.suppliers.detail", {
          count: dashboard.supplierProcurements.length,
        }),
        label: t("controlPanel.metrics.suppliers.label"),
        to: "/suppliers",
        value: supplierAttention,
      },
      {
        body: t("controlPanel.metrics.support.body"),
        detail: t("controlPanel.metrics.support.detail", {
          risk: highRiskEvents,
          channels: enabledChannels,
          unhealthy: unhealthyChannels,
        }),
        label: t("controlPanel.metrics.support.label"),
        to: "/after-sales",
        value: openAfterSales,
      },
    ]
  }, [dashboard, t])

  const attentionItems = useMemo(
    () => [
      {
        body:
          dashboard.catalogVariants.find(
            (variant) =>
              variant.credential_inventory_supported &&
              (variant.available_count || 0) <= 0
          )?.product_title || t("controlPanel.attention.emptyCatalog"),
        count: dashboard.catalogVariants.filter(
          (variant) =>
            variant.credential_inventory_supported &&
            (variant.available_count || 0) <= 0
        ).length,
        label: t("controlPanel.attention.catalogReview"),
        to: "/product-publishing",
      },
      {
        body:
          dashboard.pendingDeliveries[0]?.display_label ||
          t("controlPanel.attention.emptyDelivery"),
        count: dashboard.pendingDeliveries.length,
        label: t("controlPanel.attention.pendingDelivery"),
        to: "/deliveries",
      },
      {
        body:
          dashboard.paymentAttempts.find(
            (attempt) => !["paid", "refunded"].includes(attempt.status)
          )?.id || t("controlPanel.attention.emptyPayment"),
        count: dashboard.paymentAttempts.filter(
          (attempt) => !["paid", "refunded"].includes(attempt.status)
        ).length,
        label: t("controlPanel.attention.paymentReview"),
        to: "/payments",
      },
      {
        body:
          dashboard.supplierProcurements.find((item) =>
            ["failed", "needs_review"].includes(item.status)
          )?.id || t("controlPanel.attention.emptySupplier"),
        count: dashboard.supplierProcurements.filter((item) =>
          ["failed", "needs_review"].includes(item.status)
        ).length,
        label: t("controlPanel.attention.supplierReview"),
        to: "/suppliers",
      },
      {
        body:
          dashboard.afterSales.find((item) =>
            ["open", "processing"].includes(item.status)
          )?.reason || t("controlPanel.attention.emptyAfterSales"),
        count: dashboard.afterSales.filter((item) =>
          ["open", "processing"].includes(item.status)
        ).length,
        label: t("controlPanel.attention.afterSalesReview"),
        to: "/after-sales",
      },
      {
        body:
          dashboard.auditLogs.find((log) => log.risk_level === "high")
            ?.action || t("controlPanel.attention.emptyAudit"),
        count: dashboard.auditLogs.filter((log) => log.risk_level === "high")
          .length,
        label: t("controlPanel.attention.auditReview"),
        to: "/audit-logs",
      },
    ],
    [dashboard, t]
  )

  async function refresh() {
    setError("")
    setLoading(true)

    const results = await Promise.allSettled([
      adminApi<{ channels: PaymentChannel[] }>("/admin/payment-channels"),
      adminApi<{ attempts: PaymentAttempt[] }>("/admin/payment-attempts?limit=25"),
      adminApi<{ batches: CredentialBatch[] }>("/admin/credential-inventory/batches"),
      adminApi<{ items: PendingDeliveryItem[] }>("/admin/digital-delivery/pending?limit=25"),
      adminApi<{ audit_logs: AuditLog[] }>("/admin/audit-logs?limit=25"),
      adminApi<{ variants: CatalogVariant[] }>("/admin/catalog/variants"),
      adminApi<{ procurements: SupplierProcurement[] }>(
        "/admin/suppliers/procurements?limit=25"
      ),
      adminApi<{ after_sales: AfterSale[] }>("/admin/after-sales"),
    ])

    const [
      channels,
      paymentAttempts,
      batches,
      pendingDeliveries,
      auditLogs,
      catalogVariants,
      supplierProcurements,
      afterSales,
    ] = results

    setDashboard({
      afterSales: fulfilledValue(afterSales, { after_sales: [] }).after_sales,
      auditLogs: fulfilledValue(auditLogs, { audit_logs: [] }).audit_logs,
      batches: fulfilledValue(batches, { batches: [] }).batches,
      catalogVariants: fulfilledValue(catalogVariants, { variants: [] })
        .variants,
      channels: fulfilledValue(channels, { channels: [] }).channels,
      paymentAttempts: fulfilledValue(paymentAttempts, { attempts: [] })
        .attempts,
      pendingDeliveries: fulfilledValue(pendingDeliveries, { items: [] }).items,
      supplierProcurements: fulfilledValue(supplierProcurements, {
        procurements: [],
      }).procurements,
    })

    if (results.some((result) => result.status === "rejected")) {
      setError(t("controlPanel.partialLoadFailed"))
    }

    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-y-4">
      <Container className="p-0">
        <div className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-[760px]">
            <Heading level="h1">{t("controlPanel.title")}</Heading>
            <Text className="mt-2 text-ui-fg-subtle">
              {t("controlPanel.description")}
            </Text>
          </div>
          <div className="w-full lg:w-[340px]">
            <AdminLanguageSwitcher />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-ui-border-base px-6 py-3">
          <Button onClick={refresh} disabled={loading}>
            {loading
              ? t("controlPanel.refreshing")
              : t("common.actions.refresh")}
          </Button>
          <Button asChild variant="secondary">
            <Link to="/products/create">{t("controlPanel.createProduct")}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/product-publishing">{t("controlPanel.primaryAction")}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/payments">{t("controlPanel.secondaryAction")}</Link>
          </Button>
          {error ? <Text className="text-ui-fg-error">{error}</Text> : null}
        </div>
      </Container>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {metrics.map((metric) => (
          <Container key={metric.label} className="p-0">
            <Link to={metric.to} className="block px-5 py-4">
              <Text className="text-ui-fg-subtle">{metric.label}</Text>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-semibold text-ui-fg-base">
                  {metric.value}
                </span>
                <Text className="text-ui-fg-subtle">{metric.body}</Text>
              </div>
              <Text className="mt-2 text-ui-fg-subtle">{metric.detail}</Text>
            </Link>
          </Container>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Container className="divide-y p-0">
          <SectionHeader
            title={t("controlPanel.attention.title")}
            description={t("controlPanel.attention.description")}
          />
          <div className="divide-y">
            {attentionItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="grid gap-3 px-6 py-4 md:grid-cols-[120px_minmax(0,1fr)_auto] md:items-center"
              >
                <Badge>{item.count}</Badge>
                <div>
                  <Heading level="h3">{item.label}</Heading>
                  <Text className="mt-1 truncate text-ui-fg-subtle">
                    {item.body}
                  </Text>
                </div>
                <Text className="text-ui-fg-interactive">
                  {t("controlPanel.open")}
                </Text>
              </Link>
            ))}
          </div>
        </Container>

        <Container className="divide-y p-0">
          <SectionHeader
            title={t("controlPanel.workflow.title")}
            description={t("controlPanel.workflow.description")}
          />
          <div className="divide-y">
            {workflowLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="block px-6 py-4 transition-fg hover:bg-ui-bg-subtle"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Heading level="h3">{t(link.titleKey)}</Heading>
                    <Text className="mt-1 text-ui-fg-subtle">
                      {t(link.bodyKey)}
                    </Text>
                  </div>
                  <Text className="shrink-0 text-ui-fg-interactive">
                    {t(link.commandKey)}
                  </Text>
                </div>
              </Link>
            ))}
          </div>
        </Container>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Container className="divide-y p-0">
          <SectionHeader
            title={t("controlPanel.recentPayments.title")}
            description={t("controlPanel.recentPayments.description")}
          />
          <div className="divide-y">
            {dashboard.paymentAttempts.slice(0, 5).map((attempt) => (
              <div
                key={attempt.id}
                className="grid gap-2 px-6 py-3 md:grid-cols-[minmax(0,1fr)_120px_120px] md:items-center"
              >
                <div className="min-w-0">
                  <Text className="truncate font-mono">{attempt.id}</Text>
                  <Text className="text-ui-fg-subtle">
                    {attempt.provider_code} · {formatDate(attempt.created_at)}
                  </Text>
                </div>
                <Badge>{translatedStatus(t, attempt.status)}</Badge>
                <Text className="font-mono">
                  {attempt.amount} {attempt.currency}
                </Text>
              </div>
            ))}
            {dashboard.paymentAttempts.length === 0 ? (
              <EmptyRow label={t("controlPanel.empty")} />
            ) : null}
          </div>
        </Container>

        <Container className="divide-y p-0">
          <SectionHeader
            title={t("controlPanel.recentAudit.title")}
            description={t("controlPanel.recentAudit.description")}
          />
          <div className="divide-y">
            {dashboard.auditLogs.slice(0, 5).map((log) => (
              <div
                key={log.id}
                className="grid gap-2 px-6 py-3 md:grid-cols-[minmax(0,1fr)_96px_128px] md:items-center"
              >
                <div className="min-w-0">
                  <Text className="truncate">{log.action}</Text>
                  <Text className="truncate text-ui-fg-subtle">
                    {log.entity_type}:{log.entity_id || "-"}
                  </Text>
                </div>
                <Badge>{translatedStatus(t, log.risk_level)}</Badge>
                <Text className="text-ui-fg-subtle">
                  {formatDate(log.created_at)}
                </Text>
              </div>
            ))}
            {dashboard.auditLogs.length === 0 ? (
              <EmptyRow label={t("controlPanel.empty")} />
            ) : null}
          </div>
        </Container>
      </div>
    </div>
  )
}

function SectionHeader(props: { title: string; description: string }) {
  return (
    <div className="px-6 py-4">
      <Heading level="h2">{props.title}</Heading>
      <Text className="mt-1 text-ui-fg-subtle">{props.description}</Text>
    </div>
  )
}

function EmptyRow(props: { label: string }) {
  return (
    <div className="px-6 py-6">
      <Text className="text-ui-fg-subtle">{props.label}</Text>
    </div>
  )
}

function fulfilledValue<T>(result: PromiseSettledResult<T>, fallback: T) {
  return result.status === "fulfilled" ? result.value : fallback
}

function sumBy<T>(items: T[], getValue: (item: T) => number) {
  return items.reduce((total, item) => total + getValue(item), 0)
}

export const config = defineRouteConfig({
  label: "adminRoutes.controlPanel",
  translationNs: "translation",
  rank: 1,
})

export default ControlPanelPage
