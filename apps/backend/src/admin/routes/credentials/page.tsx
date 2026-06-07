import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Heading, Input, Table, Text, Textarea } from "@medusajs/ui"
import { FormEvent, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { AdminSection } from "../../components/admin-section"
import { MessageBox } from "../../components/message-box"
import { adminApi, formatDate } from "../../lib/admin-api"
import { translatedStatus } from "../../lib/i18n"

type AccountItem = {
  id: string
  product_variant_id: string
  status: string
  display_label: string
  account_identifier: string
  reservation_key?: string | null
  cart_id?: string | null
  order_id?: string | null
  sold_at?: string | null
  delivered_at?: string | null
  created_at?: string
}

type Batch = {
  id: string
  name: string
  product_variant_id: string
  status: string
  total_count: number
  available_count: number
  reserved_count: number
  sold_count: number
}

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
  availability_supported: boolean
  total_count: number | null
  available_count: number | null
  reserved_count: number | null
  sold_count: number | null
  locked_count: number | null
  is_in_stock: boolean | null
}

type ImportItem = {
  account_identifier?: string
  display_label?: string
  credential: Record<string, unknown> | string
}

const SAMPLE_IMPORT = `demo1----secret1
demo2,secret2
CARD-AAAA-BBBB-CCCC`

type Translate = (key: string, options?: Record<string, unknown>) => string

function parseCredentialLines(value: string, t: Translate): ImportItem[] {
  const text = value.trim()

  if (!text) {
    throw new Error(t("credentials.importTextRequired"))
  }

  if (text.startsWith("[")) {
    const parsed = JSON.parse(text) as ImportItem[]
    if (!Array.isArray(parsed)) {
      throw new Error(t("credentials.jsonArrayRequired"))
    }

    return parsed
  }

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      if (line.startsWith("{")) {
        const parsed = JSON.parse(line) as ImportItem
        if (typeof parsed.credential === "undefined") {
          throw new Error(t("credentials.missingCredential", { line: index + 1 }))
        }

        return parsed
      }

      const delimiter = ["----", "\t", ",", "|", ":"].find((candidate) =>
        line.includes(candidate)
      )

      if (!delimiter) {
        return {
          display_label: t("credentials.cardLabel", { number: index + 1 }),
          credential: line,
        }
      }

      const delimiterIndex = line.indexOf(delimiter)
      const username = line.slice(0, delimiterIndex).trim()
      const password = line.slice(delimiterIndex + delimiter.length).trim()

      if (!username || !password) {
        throw new Error(
          t("credentials.accountPasswordError", { line: index + 1 })
        )
      }

      return {
        display_label: t("credentials.accountLabel", { number: index + 1 }),
        credential: {
          username,
          password,
        },
      }
    })
}

const CredentialsPage = () => {
  const { t } = useTranslation()
  const [items, setItems] = useState<AccountItem[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [name, setName] = useState(t("credentials.manualImport"))
  const [productVariantId, setProductVariantId] = useState("")
  const [templateCode, setTemplateCode] = useState("credential")
  const [credentialsText, setCredentialsText] = useState(SAMPLE_IMPORT)
  const [templates, setTemplates] = useState<ProductTemplate[]>([])
  const [catalogVariants, setCatalogVariants] = useState<CatalogVariant[]>([])
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const selectedVariant =
    catalogVariants.find((variant) => variant.id === productVariantId.trim()) ||
    null

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    setError("")

    try {
      const [itemsData, batchesData, templateData, catalogData] =
        await Promise.all([
          adminApi<{ items: AccountItem[] }>("/admin/credential-inventory/items"),
          adminApi<{ batches: Batch[] }>("/admin/credential-inventory/batches"),
          adminApi<{ templates: ProductTemplate[] }>("/admin/product-templates"),
          adminApi<{ variants: CatalogVariant[] }>("/admin/catalog/variants"),
        ])
      setItems(itemsData.items)
      setBatches(batchesData.batches)
      setTemplates(templateData.templates)
      setCatalogVariants(catalogData.variants)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("credentials.loadFailed"))
    }
  }

  function handleProductVariantIdChange(value: string) {
    const normalizedValue = value.trim()
    setProductVariantId(value)

    const variant = catalogVariants.find((item) => item.id === normalizedValue)
    if (variant?.template_code) {
      setTemplateCode(variant.template_code)
    }
  }

  function handleVariantSelect(variantId: string) {
    setProductVariantId(variantId)

    const variant = catalogVariants.find((item) => item.id === variantId)
    if (variant?.template_code) {
      setTemplateCode(variant.template_code)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    try {
      const normalizedProductVariantId = productVariantId.trim()

      if (!normalizedProductVariantId) {
        throw new Error(t("credentials.variantRequired"))
      }

      if (selectedVariant && !selectedVariant.credential_inventory_supported) {
        throw new Error(t("credentials.unsupportedVariant"))
      }

      const parsed = parseCredentialLines(credentialsText, t)

      await adminApi("/admin/credential-inventory/batches", {
        method: "POST",
        body: {
          name,
          product_variant_id: normalizedProductVariantId,
          template_code: templateCode.trim(),
          items: parsed,
        },
      })
      setMessage(t("credentials.imported"))
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("credentials.importFailed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-4">
      <AdminSection
        title={t("credentials.title")}
        description={t("credentials.description")}
      >
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              aria-label={t("credentials.batchName")}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("credentials.batchName")}
            />
            <div className="grid gap-1">
              <select
                aria-label={t("credentials.productVariant")}
                value={productVariantId}
                onChange={(event) => handleVariantSelect(event.target.value)}
                className="h-8 rounded-md border border-ui-border-base bg-ui-bg-field px-2 text-sm text-ui-fg-base outline-none transition-fg focus:border-ui-border-interactive"
              >
                <option value="">{t("credentials.selectProductVariant")}</option>
                {catalogVariants.map((variant) => (
                  <option
                    key={variant.id}
                    value={variant.id}
                    disabled={!variant.credential_inventory_supported}
                  >
                    {variantOptionLabel(variant, t)}
                  </option>
                ))}
              </select>
              {catalogVariants.length ? null : (
                <Text className="text-ui-fg-subtle">
                  {t("credentials.noCatalogVariants")}
                </Text>
              )}
            </div>
            <Input
              value={productVariantId}
              aria-label={t("credentials.manualVariantId")}
              onChange={(event) => handleProductVariantIdChange(event.target.value)}
              placeholder="variant_..."
            />
            <Input
              value={templateCode}
              aria-label={t("credentials.templateCode")}
              onChange={(event) => setTemplateCode(event.target.value)}
              placeholder="template_code"
            />
          </div>
          {selectedVariant ? (
            <Text className="text-ui-fg-subtle">
              {selectedVariantSummary(selectedVariant, t)}
            </Text>
          ) : productVariantId.trim() ? (
            <Text className="text-ui-fg-subtle">
              {t("credentials.manualVariantIdHelp")}
            </Text>
          ) : (
            <Text className="text-ui-fg-subtle">
              {t("credentials.selectProductVariantHelp")}
            </Text>
          )}
          {templates.length ? (
            <div className="grid gap-2 md:grid-cols-2">
              {templates.map((template) => (
                <button
                  key={template.code}
                  type="button"
                  onClick={() => setTemplateCode(template.code)}
                  className={`border px-3 py-3 text-left ${
                    templateCode === template.code
                      ? "border-ui-border-interactive bg-ui-bg-component"
                      : "border-ui-border-base"
                  }`}
                >
                  <div className="font-medium">{template.title}</div>
                  <div className="mt-1 text-sm text-ui-fg-subtle">
                    {template.description}
                  </div>
                  <div className="mt-2 font-mono text-xs text-ui-fg-muted">
                    {template.code} / {template.productType}
                  </div>
                </button>
              ))}
            </div>
          ) : null}
          <Textarea
            value={credentialsText}
            onChange={(event) => setCredentialsText(event.target.value)}
            className="min-h-40 font-mono"
          />
          <Text className="text-ui-fg-subtle">
            {t("credentials.templateHelp")}
          </Text>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? t("credentials.importing") : t("credentials.importCredentials")}
            </Button>
            <Button type="button" variant="secondary" onClick={refresh}>
              {t("common.actions.refresh")}
            </Button>
          </div>
          <MessageBox error={error} success={message} />
        </form>
      </AdminSection>

      <AdminSection title={t("credentials.batches")}>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{t("common.fields.name")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.variant")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.status")}</Table.HeaderCell>
              <Table.HeaderCell>{t("credentials.counts")}</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {batches.map((batch) => (
              <Table.Row key={batch.id}>
                <Table.Cell>{batch.name}</Table.Cell>
                <Table.Cell className="font-mono">{batch.product_variant_id}</Table.Cell>
                <Table.Cell>
                  <Badge>{translatedStatus(t, batch.status)}</Badge>
                </Table.Cell>
                <Table.Cell>
                  {t("credentials.countsText", {
                    available: batch.available_count,
                    reserved: batch.reserved_count,
                    sold: batch.sold_count,
                    total: batch.total_count,
                  })}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </AdminSection>

      <AdminSection title={t("credentials.items")}>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{t("credentials.label")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.status")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.variant")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.order")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.delivered")}</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {items.map((item) => (
              <Table.Row key={item.id}>
                <Table.Cell>
                  <div>
                    <Heading level="h3">{item.display_label}</Heading>
                    <Text className="font-mono text-ui-fg-subtle">
                      {item.account_identifier}
                    </Text>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Badge>{translatedStatus(t, item.status)}</Badge>
                </Table.Cell>
                <Table.Cell className="font-mono">{item.product_variant_id}</Table.Cell>
                <Table.Cell className="font-mono">{item.order_id || item.cart_id || "-"}</Table.Cell>
                <Table.Cell>{formatDate(item.delivered_at)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </AdminSection>
    </div>
  )
}

function variantOptionLabel(variant: CatalogVariant, t: Translate) {
  const productName =
    variant.product_title || variant.product_handle || variant.product_id || "-"
  const variantName = variant.title || variant.sku || variant.id
  const sku = variant.sku ? ` / ${variant.sku}` : ""
  const stock =
    typeof variant.available_count === "number"
      ? t("credentials.availableCount", { count: variant.available_count })
      : t("credentials.stockUnknown")
  const unsupported = variant.credential_inventory_supported
    ? ""
    : ` / ${t("credentials.notCredentialInventory")}`

  return `${productName} / ${variantName}${sku} / ${variant.template_title} / ${stock}${unsupported}`
}

function selectedVariantSummary(variant: CatalogVariant, t: Translate) {
  const deliveryHandler = variant.delivery_handler_code || "-"
  const stock =
    typeof variant.available_count === "number"
      ? t("credentials.stockSummary", {
          available: variant.available_count,
          reserved: variant.reserved_count ?? 0,
          sold: variant.sold_count ?? 0,
          total: variant.total_count ?? 0,
        })
      : t("credentials.stockUnknown")

  return t("credentials.selectedVariantSummary", {
    inventoryHandler: variant.inventory_handler_code,
    deliveryHandler,
    stock,
  })
}

export const config = defineRouteConfig({
  label: "Credentials / 凭证",
  rank: 20,
})

export default CredentialsPage
