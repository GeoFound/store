import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Heading, Table, Text } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { AdminSection } from "../../components/admin-section"
import { MessageBox } from "../../components/message-box"
import { adminApi } from "../../lib/admin-api"
import { translatedStatus } from "../../lib/i18n"

type ProductTemplate = {
  code: string
  title: string
  description: string
  productType: string
  fulfillmentPolicyCode?: string
  deliveryHandlerCode?: string
  inventoryHandlerCode?: string
}

type CatalogVariant = {
  id: string
  title: string | null
  sku: string | null
  product_id: string | null
  product_title: string | null
  product_handle: string | null
  product_type: string | null
  template_code: string
  template_title: string
  inventory_handler_code: string
  delivery_handler_code: string | null
  credential_inventory_supported: boolean
  total_count: number | null
  available_count: number | null
  reserved_count: number | null
  sold_count: number | null
  is_in_stock: boolean | null
}

type ReadinessState =
  | "ready"
  | "needs_stock"
  | "external"
  | "manual"
  | "unknown"

const ProductPublishingPage = () => {
  const { t } = useTranslation()
  const [templates, setTemplates] = useState<ProductTemplate[]>([])
  const [variants, setVariants] = useState<CatalogVariant[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void refresh()
  }, [])

  const summary = useMemo(() => {
    return variants.reduce(
      (current, variant) => {
        const state = readinessState(variant)
        current.total += 1
        current[state] += 1
        return current
      },
      {
        external: 0,
        manual: 0,
        needs_stock: 0,
        ready: 0,
        total: 0,
        unknown: 0,
      } as Record<ReadinessState | "total", number>
    )
  }, [variants])

  async function refresh() {
    setLoading(true)
    setError("")

    try {
      const [templateData, variantData] = await Promise.all([
        adminApi<{ templates: ProductTemplate[] }>("/admin/product-templates"),
        adminApi<{ variants: CatalogVariant[] }>("/admin/catalog/variants"),
      ])
      setTemplates(templateData.templates || [])
      setVariants(variantData.variants || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t("productPublishing.loadFailed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-4">
      <AdminSection
        title={t("productPublishing.title")}
        description={t("productPublishing.description")}
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-4">
            <SummaryTile
              label={t("productPublishing.metrics.total")}
              value={summary.total}
            />
            <SummaryTile
              label={t("productPublishing.metrics.ready")}
              value={summary.ready}
            />
            <SummaryTile
              label={t("productPublishing.metrics.needsStock")}
              value={summary.needs_stock}
            />
            <SummaryTile
              label={t("productPublishing.metrics.external")}
              value={summary.external + summary.manual + summary.unknown}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link to="/products/create">
                {t("productPublishing.actions.createProduct")}
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/products">{t("productPublishing.actions.products")}</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/credentials">
                {t("productPublishing.actions.credentials")}
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/suppliers">
                {t("productPublishing.actions.suppliers")}
              </Link>
            </Button>
            <Button type="button" variant="secondary" onClick={() => void refresh()}>
              {loading
                ? t("productPublishing.actions.refreshing")
                : t("common.actions.refresh")}
            </Button>
          </div>
          <MessageBox error={error} />
        </div>
      </AdminSection>

      <AdminSection
        title={t("productPublishing.readiness")}
        description={t("productPublishing.readinessDescription")}
      >
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{t("common.fields.variant")}</Table.HeaderCell>
              <Table.HeaderCell>{t("productPublishing.template")}</Table.HeaderCell>
              <Table.HeaderCell>{t("productPublishing.handlers")}</Table.HeaderCell>
              <Table.HeaderCell>{t("productPublishing.stock")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.status")}</Table.HeaderCell>
              <Table.HeaderCell></Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {variants.map((variant) => {
              const state = readinessState(variant)

              return (
                <Table.Row key={variant.id}>
                  <Table.Cell>
                    <div>
                      <Heading level="h3">
                        {variant.product_title || variant.product_handle || "-"}
                      </Heading>
                      <Text className="text-ui-fg-subtle">
                        {variant.title || variant.sku || variant.id}
                      </Text>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div>
                      <Text>{variant.template_title}</Text>
                      <Text className="font-mono text-ui-fg-subtle">
                        {variant.template_code}
                      </Text>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="font-mono text-ui-fg-subtle">
                      {variant.inventory_handler_code} /{" "}
                      {variant.delivery_handler_code || "-"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>{stockLabel(variant, t)}</Table.Cell>
                  <Table.Cell>
                    <Badge color={stateColor(state)}>
                      {translatedStatus(t, state)}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex justify-end gap-2">
                      {variant.product_id ? (
                        <Button asChild variant="secondary">
                          <Link to={`/products/${variant.product_id}`}>
                            {t("productPublishing.actions.openProduct")}
                          </Link>
                        </Button>
                      ) : null}
                      {variant.credential_inventory_supported ? (
                        <Button asChild variant="secondary">
                          <Link to="/credentials">
                            {t("productPublishing.actions.stock")}
                          </Link>
                        </Button>
                      ) : variant.delivery_handler_code === "supplier-procurement" ? (
                        <Button asChild variant="secondary">
                          <Link to="/suppliers">
                            {t("productPublishing.actions.mapping")}
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </Table.Cell>
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table>
        {variants.length ? null : (
          <Text className="p-4 text-ui-fg-subtle">
            {t("productPublishing.emptyVariants")}
          </Text>
        )}
      </AdminSection>

      <AdminSection
        title={t("productPublishing.templates")}
        description={t("productPublishing.templatesDescription")}
      >
        <div id="templates">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{t("productPublishing.template")}</Table.HeaderCell>
                <Table.HeaderCell>{t("common.fields.type")}</Table.HeaderCell>
                <Table.HeaderCell>{t("productPublishing.fulfillment")}</Table.HeaderCell>
                <Table.HeaderCell>{t("productPublishing.inventory")}</Table.HeaderCell>
                <Table.HeaderCell>{t("productPublishing.delivery")}</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {templates.map((template) => (
                <Table.Row key={template.code}>
                  <Table.Cell>
                    <div>
                      <Heading level="h3">{template.title}</Heading>
                      <Text className="font-mono text-ui-fg-subtle">
                        {template.code}
                      </Text>
                    </div>
                  </Table.Cell>
                  <Table.Cell>{template.productType}</Table.Cell>
                  <Table.Cell>{template.fulfillmentPolicyCode || "-"}</Table.Cell>
                  <Table.Cell>{template.inventoryHandlerCode || "-"}</Table.Cell>
                  <Table.Cell>{template.deliveryHandlerCode || "-"}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      </AdminSection>
    </div>
  )
}

function SummaryTile(props: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-ui-border-base bg-ui-bg-subtle px-4 py-3">
      <Text className="text-ui-fg-subtle">{props.label}</Text>
      <Heading level="h2">{props.value}</Heading>
    </div>
  )
}

function readinessState(variant: CatalogVariant): ReadinessState {
  if (variant.credential_inventory_supported) {
    return (variant.available_count || 0) > 0 ? "ready" : "needs_stock"
  }

  if (variant.delivery_handler_code === "supplier-procurement") {
    return "external"
  }

  if (variant.delivery_handler_code === "manual") {
    return "manual"
  }

  return "unknown"
}

function stockLabel(
  variant: CatalogVariant,
  t: (key: string, options?: Record<string, unknown>) => string
) {
  if (!variant.credential_inventory_supported) {
    return t("productPublishing.notInventoryBacked")
  }

  return t("productPublishing.stockSummary", {
    available: variant.available_count ?? 0,
    reserved: variant.reserved_count ?? 0,
    sold: variant.sold_count ?? 0,
    total: variant.total_count ?? 0,
  })
}

function stateColor(state: ReadinessState) {
  if (state === "ready") {
    return "green"
  }

  if (state === "needs_stock") {
    return "orange"
  }

  return "grey"
}

export const config = defineRouteConfig({
  label: "adminRoutes.productPublishing",
  translationNs: "translation",
  rank: 2,
})

export default ProductPublishingPage
