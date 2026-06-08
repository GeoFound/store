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

type MarketingCampaign = {
  id: string
  code: string
  name: string
  status: string
  created_at?: string | null
}

type MarketingCoupon = {
  id: string
  code: string
  status: string
  redeemed_count: number
  created_at?: string | null
}

type MarketingReferralLink = {
  id: string
  code: string
  status: string
  used_count: number
  created_at?: string | null
}

type MarketingTouchpoint = {
  id: string
  event_name: string
  coupon_code?: string | null
  referral_code?: string | null
  created_at?: string | null
}

type AnalyticsEvent = {
  id: string
  event_name: string
  status: string
  source: string
  created_at?: string | null
}

type AnalyticsDispatch = {
  id: string
  destination_code: string
  status: string
  attempt_count: number
  error_message?: string | null
  created_at?: string | null
}

type ContentEntry = {
  id: string
  site_id: string
  title: string
  slug: string
  status: string
  created_at?: string | null
  published_at?: string | null
}

type AIProviderConfig = {
  code: string
  label: string
  status: string
  enabled: boolean
}

type AITaskRun = {
  id: string
  task_type: string
  plugin_code: string
  provider_code: string | null
  status: string
  created_at: string | null
}

type AISnapshot = {
  providers: AIProviderConfig[]
  task_runs: AITaskRun[]
  summary: {
    provider_count: number
    configured_provider_count: number
    attention_provider_count: number
    review_run_count: number
  }
}

type ControlPanelState = {
  afterSales: AfterSale[]
  analyticsDispatches: AnalyticsDispatch[]
  analyticsEvents: AnalyticsEvent[]
  aiProviders: AIProviderConfig[]
  aiTaskRuns: AITaskRun[]
  aiSummary: AISnapshot["summary"]
  auditLogs: AuditLog[]
  batches: CredentialBatch[]
  channels: PaymentChannel[]
  catalogVariants: CatalogVariant[]
  contentEntries: ContentEntry[]
  marketingCampaigns: MarketingCampaign[]
  marketingCoupons: MarketingCoupon[]
  marketingReferralLinks: MarketingReferralLink[]
  marketingTouchpoints: MarketingTouchpoint[]
  paymentAttempts: PaymentAttempt[]
  pendingDeliveries: PendingDeliveryItem[]
  supplierProcurements: SupplierProcurement[]
}

const EMPTY_STATE: ControlPanelState = {
  afterSales: [],
  analyticsDispatches: [],
  analyticsEvents: [],
  aiProviders: [],
  aiTaskRuns: [],
  aiSummary: {
    provider_count: 0,
    configured_provider_count: 0,
    attention_provider_count: 0,
    review_run_count: 0,
  },
  auditLogs: [],
  batches: [],
  channels: [],
  catalogVariants: [],
  contentEntries: [],
  marketingCampaigns: [],
  marketingCoupons: [],
  marketingReferralLinks: [],
  marketingTouchpoints: [],
  paymentAttempts: [],
  pendingDeliveries: [],
  supplierProcurements: [],
}

const PAYMENT_DONE_STATUSES = new Set(["paid", "refunded"])
const CHANNEL_READY_STATUSES = new Set(["configured", "healthy", "active"])
const SUPPLIER_ATTENTION_STATUSES = new Set(["failed", "needs_review"])
const AFTER_SALES_OPEN_STATUSES = new Set(["open", "processing"])
const ANALYTICS_ATTENTION_STATUSES = new Set(["failed", "dead"])
const CONTENT_REVIEW_STATUSES = new Set(["review"])
const AI_ATTENTION_STATUSES = new Set([
  "invalid",
  "missing_key_ref",
  "missing_secret",
])
const AI_REVIEW_STATUSES = new Set(["requires_review"])

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
    bodyKey: "controlPanel.links.content.body",
    commandKey: "controlPanel.links.content.command",
    titleKey: "controlPanel.links.content.title",
    to: "/content",
  },
  {
    bodyKey: "controlPanel.links.marketing.body",
    commandKey: "controlPanel.links.marketing.command",
    titleKey: "controlPanel.links.marketing.title",
    to: "/marketing",
  },
  {
    bodyKey: "controlPanel.links.analytics.body",
    commandKey: "controlPanel.links.analytics.command",
    titleKey: "controlPanel.links.analytics.title",
    to: "/analytics",
  },
  {
    bodyKey: "controlPanel.links.ai.body",
    commandKey: "controlPanel.links.ai.command",
    titleKey: "controlPanel.links.ai.title",
    to: "/ai",
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

      return !CHANNEL_READY_STATUSES.has(channel.health_status)
    }).length
    const paymentAttentionCount = dashboard.paymentAttempts.filter(
      (attempt) => !PAYMENT_DONE_STATUSES.has(attempt.status)
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
      SUPPLIER_ATTENTION_STATUSES.has(item.status)
    ).length
    const openAfterSales = dashboard.afterSales.filter((item) =>
      AFTER_SALES_OPEN_STATUSES.has(item.status)
    ).length
    const activeCampaigns = dashboard.marketingCampaigns.filter(
      (campaign) => campaign.status === "active"
    ).length
    const activeCoupons = dashboard.marketingCoupons.filter(
      (coupon) => coupon.status === "active"
    ).length
    const activeReferralLinks = dashboard.marketingReferralLinks.filter(
      (link) => link.status === "active"
    ).length
    const contentReviewCount = dashboard.contentEntries.filter((entry) =>
      CONTENT_REVIEW_STATUSES.has(entry.status)
    ).length
    const publishedContentCount = dashboard.contentEntries.filter(
      (entry) => entry.status === "published"
    ).length
    const analyticsAttention = dashboard.analyticsDispatches.filter((dispatch) =>
      ANALYTICS_ATTENTION_STATUSES.has(dispatch.status)
    ).length
    const aiAttention = dashboard.aiProviders.filter((provider) =>
      AI_ATTENTION_STATUSES.has(provider.status)
    ).length
    const aiReviewRuns = dashboard.aiTaskRuns.filter((run) =>
      AI_REVIEW_STATUSES.has(run.status)
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
        body: t("controlPanel.metrics.channels.body"),
        detail: t("controlPanel.metrics.channels.detail", {
          unhealthy: unhealthyChannels,
        }),
        label: t("controlPanel.metrics.channels.label"),
        to: "/payments",
        value: enabledChannels,
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
        body: t("controlPanel.metrics.marketing.body"),
        detail: t("controlPanel.metrics.marketing.detail", {
          coupons: activeCoupons,
          referrals: activeReferralLinks,
        }),
        label: t("controlPanel.metrics.marketing.label"),
        to: "/marketing",
        value: activeCampaigns,
      },
      {
        body: t("controlPanel.metrics.content.body"),
        detail: t("controlPanel.metrics.content.detail", {
          review: contentReviewCount,
        }),
        label: t("controlPanel.metrics.content.label"),
        to: "/content",
        value: publishedContentCount,
      },
      {
        body: t("controlPanel.metrics.analytics.body"),
        detail: t("controlPanel.metrics.analytics.detail", {
          count: dashboard.analyticsDispatches.length,
        }),
        label: t("controlPanel.metrics.analytics.label"),
        to: "/analytics",
        value: analyticsAttention,
      },
      {
        body: t("controlPanel.metrics.ai.body"),
        detail: t("controlPanel.metrics.ai.detail", {
          attention: aiAttention,
          review: aiReviewRuns,
        }),
        label: t("controlPanel.metrics.ai.label"),
        to: "/ai",
        value: dashboard.aiSummary.configured_provider_count,
      },
      {
        body: t("controlPanel.metrics.risk.body"),
        detail: t("controlPanel.metrics.risk.detail"),
        label: t("controlPanel.metrics.risk.label"),
        to: "/audit-logs",
        value: highRiskEvents,
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

  const operatorSignals = useMemo(() => {
    const enabledChannels = dashboard.channels.filter(
      (channel) => channel.enabled
    )
    const unhealthyChannels = enabledChannels.filter(
      (channel) => !CHANNEL_READY_STATUSES.has(channel.health_status)
    )
    const lowStockBatches = dashboard.batches.filter(
      (batch) => batch.available_count <= 0
    )
    const activeCampaigns = dashboard.marketingCampaigns.filter(
      (campaign) => campaign.status === "active"
    )
    const contentInReview = dashboard.contentEntries.filter((entry) =>
      CONTENT_REVIEW_STATUSES.has(entry.status)
    )
    const publishedContent = dashboard.contentEntries.filter(
      (entry) => entry.status === "published"
    )
    const failedDispatches = dashboard.analyticsDispatches.filter((dispatch) =>
      ANALYTICS_ATTENTION_STATUSES.has(dispatch.status)
    )
    const aiProvidersNeedingAttention = dashboard.aiProviders.filter((provider) =>
      AI_ATTENTION_STATUSES.has(provider.status)
    )

    return [
      {
        body:
          unhealthyChannels[0]?.display_name ||
          t("controlPanel.signals.payments.empty"),
        detail: t("controlPanel.signals.payments.detail", {
          enabled: enabledChannels.length,
          unhealthy: unhealthyChannels.length,
        }),
        label: t("controlPanel.signals.payments.label"),
        status: unhealthyChannels.length
          ? t("controlPanel.signals.needsReview")
          : t("controlPanel.signals.ready"),
        to: "/payments",
      },
      {
        body:
          lowStockBatches[0]?.name ||
          t("controlPanel.signals.inventory.empty"),
        detail: t("controlPanel.signals.inventory.detail", {
          available: sumBy(dashboard.batches, (batch) => batch.available_count),
          lowStock: lowStockBatches.length,
        }),
        label: t("controlPanel.signals.inventory.label"),
        status: lowStockBatches.length
          ? t("controlPanel.signals.needsStock")
          : t("controlPanel.signals.ready"),
        to: "/credentials",
      },
      {
        body:
          dashboard.marketingTouchpoints[0]?.event_name ||
          activeCampaigns[0]?.name ||
          t("controlPanel.signals.marketing.empty"),
        detail: t("controlPanel.signals.marketing.detail", {
          campaigns: activeCampaigns.length,
          touchpoints: dashboard.marketingTouchpoints.length,
        }),
        label: t("controlPanel.signals.marketing.label"),
        status: activeCampaigns.length
          ? t("controlPanel.signals.active")
          : t("controlPanel.signals.quiet"),
        to: "/marketing",
      },
      {
        body:
          contentInReview[0]?.title ||
          publishedContent[0]?.title ||
          t("controlPanel.signals.content.empty"),
        detail: t("controlPanel.signals.content.detail", {
          published: publishedContent.length,
          review: contentInReview.length,
        }),
        label: t("controlPanel.signals.content.label"),
        status: contentInReview.length
          ? t("controlPanel.signals.needsReview")
          : t("controlPanel.signals.ready"),
        to: "/content",
      },
      {
        body:
          failedDispatches[0]?.error_message ||
          dashboard.analyticsEvents[0]?.event_name ||
          t("controlPanel.signals.analytics.empty"),
        detail: t("controlPanel.signals.analytics.detail", {
          events: dashboard.analyticsEvents.length,
          failed: failedDispatches.length,
        }),
        label: t("controlPanel.signals.analytics.label"),
        status: failedDispatches.length
          ? t("controlPanel.signals.needsReplay")
          : t("controlPanel.signals.ready"),
        to: "/analytics",
      },
      {
        body:
          aiProvidersNeedingAttention[0]?.label ||
          dashboard.aiProviders[0]?.label ||
          t("controlPanel.signals.ai.empty"),
        detail: t("controlPanel.signals.ai.detail", {
          configured: dashboard.aiSummary.configured_provider_count,
          attention: dashboard.aiSummary.attention_provider_count,
        }),
        label: t("controlPanel.signals.ai.label"),
        status: aiProvidersNeedingAttention.length
          ? t("controlPanel.signals.needsReview")
          : t("controlPanel.signals.ready"),
        to: "/ai",
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
        meta: t("controlPanel.attention.catalogMeta"),
        to: "/product-publishing",
      },
      {
        body:
          dashboard.pendingDeliveries[0]?.display_label ||
          t("controlPanel.attention.emptyDelivery"),
        count: dashboard.pendingDeliveries.length,
        label: t("controlPanel.attention.pendingDelivery"),
        meta: formatDate(dashboard.pendingDeliveries[0]?.created_at),
        to: "/deliveries",
      },
      {
        body:
          dashboard.paymentAttempts.find(
            (attempt) => !PAYMENT_DONE_STATUSES.has(attempt.status)
          )?.id || t("controlPanel.attention.emptyPayment"),
        count: dashboard.paymentAttempts.filter(
          (attempt) => !PAYMENT_DONE_STATUSES.has(attempt.status)
        ).length,
        label: t("controlPanel.attention.paymentReview"),
        meta:
          translatedStatus(
            t,
            dashboard.paymentAttempts.find(
              (attempt) => !PAYMENT_DONE_STATUSES.has(attempt.status)
            )?.status
          ) || "-",
        to: "/payments",
      },
      {
        body:
          dashboard.supplierProcurements.find((item) =>
            SUPPLIER_ATTENTION_STATUSES.has(item.status)
          )?.id || t("controlPanel.attention.emptySupplier"),
        count: dashboard.supplierProcurements.filter((item) =>
          SUPPLIER_ATTENTION_STATUSES.has(item.status)
        ).length,
        label: t("controlPanel.attention.supplierReview"),
        meta: formatDate(
          dashboard.supplierProcurements.find((item) =>
            SUPPLIER_ATTENTION_STATUSES.has(item.status)
          )?.created_at
        ),
        to: "/suppliers",
      },
      {
        body:
          dashboard.afterSales.find((item) =>
            AFTER_SALES_OPEN_STATUSES.has(item.status)
          )?.reason || t("controlPanel.attention.emptyAfterSales"),
        count: dashboard.afterSales.filter((item) =>
          AFTER_SALES_OPEN_STATUSES.has(item.status)
        ).length,
        label: t("controlPanel.attention.afterSalesReview"),
        meta: formatDate(
          dashboard.afterSales.find((item) =>
            AFTER_SALES_OPEN_STATUSES.has(item.status)
          )?.created_at
        ),
        to: "/after-sales",
      },
      {
        body:
          dashboard.analyticsDispatches.find((dispatch) =>
            ANALYTICS_ATTENTION_STATUSES.has(dispatch.status)
          )?.destination_code || t("controlPanel.attention.emptyAnalytics"),
        count: dashboard.analyticsDispatches.filter((dispatch) =>
          ANALYTICS_ATTENTION_STATUSES.has(dispatch.status)
        ).length,
        label: t("controlPanel.attention.analyticsReview"),
        meta: formatDate(
          dashboard.analyticsDispatches.find((dispatch) =>
            ANALYTICS_ATTENTION_STATUSES.has(dispatch.status)
          )?.created_at
        ),
        to: "/analytics",
      },
      {
        body:
          dashboard.contentEntries.find((entry) =>
            CONTENT_REVIEW_STATUSES.has(entry.status)
          )?.title || t("controlPanel.attention.emptyContent"),
        count: dashboard.contentEntries.filter((entry) =>
          CONTENT_REVIEW_STATUSES.has(entry.status)
        ).length,
        label: t("controlPanel.attention.contentReview"),
        meta: formatDate(
          dashboard.contentEntries.find((entry) =>
            CONTENT_REVIEW_STATUSES.has(entry.status)
          )?.created_at
        ),
        to: "/content",
      },
      {
        body:
          dashboard.auditLogs.find((log) => log.risk_level === "high")
            ?.action || t("controlPanel.attention.emptyAudit"),
        count: dashboard.auditLogs.filter((log) => log.risk_level === "high")
          .length,
        label: t("controlPanel.attention.auditReview"),
        meta: formatDate(
          dashboard.auditLogs.find((log) => log.risk_level === "high")
            ?.created_at
        ),
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
      adminApi<{ campaigns: MarketingCampaign[] }>(
        "/admin/marketing/campaigns?limit=25"
      ),
      adminApi<{ coupons: MarketingCoupon[] }>(
        "/admin/marketing/coupons?limit=25"
      ),
      adminApi<{ referral_links: MarketingReferralLink[] }>(
        "/admin/marketing/referral-links?limit=25"
      ),
      adminApi<{ touchpoints: MarketingTouchpoint[] }>(
        "/admin/marketing/touchpoints?limit=25"
      ),
      adminApi<{ entries: ContentEntry[] }>("/admin/content/entries?limit=25"),
      adminApi<{ events: AnalyticsEvent[] }>("/admin/analytics/events?limit=25"),
      adminApi<{ dispatches: AnalyticsDispatch[] }>(
        "/admin/analytics/dispatches?limit=25"
      ),
      adminApi<AISnapshot>("/admin/ai/providers"),
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
      marketingCampaigns,
      marketingCoupons,
      marketingReferralLinks,
      marketingTouchpoints,
      contentEntries,
      analyticsEvents,
      analyticsDispatches,
      aiSnapshot,
    ] = results

    const aiData = fulfilledValue(aiSnapshot, {
      providers: [],
      task_runs: [],
      summary: {
        provider_count: 0,
        configured_provider_count: 0,
        attention_provider_count: 0,
        review_run_count: 0,
      },
    })

    setDashboard({
      afterSales: fulfilledValue(afterSales, { after_sales: [] }).after_sales,
      analyticsDispatches: fulfilledValue(analyticsDispatches, {
        dispatches: [],
      }).dispatches,
      analyticsEvents: fulfilledValue(analyticsEvents, { events: [] }).events,
      aiProviders: aiData.providers,
      aiSummary: aiData.summary,
      aiTaskRuns: aiData.task_runs,
      auditLogs: fulfilledValue(auditLogs, { audit_logs: [] }).audit_logs,
      batches: fulfilledValue(batches, { batches: [] }).batches,
      catalogVariants: fulfilledValue(catalogVariants, { variants: [] })
        .variants,
      channels: fulfilledValue(channels, { channels: [] }).channels,
      contentEntries: fulfilledValue(contentEntries, { entries: [] }).entries,
      marketingCampaigns: fulfilledValue(marketingCampaigns, {
        campaigns: [],
      }).campaigns,
      marketingCoupons: fulfilledValue(marketingCoupons, { coupons: [] })
        .coupons,
      marketingReferralLinks: fulfilledValue(marketingReferralLinks, {
        referral_links: [],
      }).referral_links,
      marketingTouchpoints: fulfilledValue(marketingTouchpoints, {
        touchpoints: [],
      }).touchpoints,
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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

      <Container className="divide-y p-0">
        <SectionHeader
          title={t("controlPanel.signals.title")}
          description={t("controlPanel.signals.description")}
        />
        <div className="grid divide-y md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-5">
          {operatorSignals.map((signal) => (
            <Link
              key={signal.label}
              to={signal.to}
              className="block min-w-0 px-6 py-4 transition-fg hover:bg-ui-bg-subtle"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Text className="text-ui-fg-subtle">{signal.label}</Text>
                  <Heading level="h3" className="mt-2 truncate">
                    {signal.body}
                  </Heading>
                </div>
                <Badge>{signal.status}</Badge>
              </div>
              <Text className="mt-2 text-ui-fg-subtle">{signal.detail}</Text>
            </Link>
          ))}
        </div>
      </Container>

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
                  <Text className="mt-1 text-ui-fg-subtle">{item.meta}</Text>
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
