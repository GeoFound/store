import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Heading, Input, Table, Text, Textarea } from "@medusajs/ui"
import { FormEvent, useEffect, useState } from "react"
import { AdminSection } from "../../components/admin-section"
import { MessageBox } from "../../components/message-box"
import { adminApi, formatDate } from "../../lib/admin-api"

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

type ImportItem = {
  account_identifier?: string
  display_label?: string
  credential: Record<string, unknown> | string
}

const SAMPLE_IMPORT = `demo1----secret1
demo2,secret2
CARD-AAAA-BBBB-CCCC`

function parseCredentialLines(value: string): ImportItem[] {
  const text = value.trim()

  if (!text) {
    throw new Error("Credential import text is required")
  }

  if (text.startsWith("[")) {
    const parsed = JSON.parse(text) as ImportItem[]
    if (!Array.isArray(parsed)) {
      throw new Error("Credentials must be a JSON array")
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
          throw new Error(`Line ${index + 1} requires credential`)
        }

        return parsed
      }

      const delimiter = ["----", "\t", ",", "|", ":"].find((candidate) =>
        line.includes(candidate)
      )

      if (!delimiter) {
        return {
          display_label: `Card ${index + 1}`,
          credential: line,
        }
      }

      const delimiterIndex = line.indexOf(delimiter)
      const username = line.slice(0, delimiterIndex).trim()
      const password = line.slice(delimiterIndex + delimiter.length).trim()

      if (!username || !password) {
        throw new Error(`Line ${index + 1} must include both account and password`)
      }

      return {
        display_label: `Account ${index + 1}`,
        credential: {
          username,
          password,
        },
      }
    })
}

const CredentialsPage = () => {
  const [items, setItems] = useState<AccountItem[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [name, setName] = useState("Manual import")
  const [productVariantId, setProductVariantId] = useState("")
  const [templateCode, setTemplateCode] = useState("credential")
  const [credentialsText, setCredentialsText] = useState(SAMPLE_IMPORT)
  const [templates, setTemplates] = useState<ProductTemplate[]>([])
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    const [itemsData, batchesData, templateData] = await Promise.all([
      adminApi<{ items: AccountItem[] }>("/admin/credential-inventory/items"),
      adminApi<{ batches: Batch[] }>("/admin/credential-inventory/batches"),
      adminApi<{ templates: ProductTemplate[] }>("/admin/product-templates"),
    ])
    setItems(itemsData.items)
    setBatches(batchesData.batches)
    setTemplates(templateData.templates)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    try {
      const parsed = parseCredentialLines(credentialsText)

      await adminApi("/admin/credential-inventory/batches", {
        method: "POST",
        body: {
          name,
          product_variant_id: productVariantId,
          template_code: templateCode,
          items: parsed,
        },
      })
      setMessage("Credential batch imported.")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-4">
      <AdminSection
        title="Credential Inventory"
        description="Import encrypted digital credentials and inspect safe inventory state."
      >
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input value={name} onChange={(event) => setName(event.target.value)} />
            <Input
              value={productVariantId}
              onChange={(event) => setProductVariantId(event.target.value)}
              placeholder="variant_..."
            />
            <Input
              value={templateCode}
              onChange={(event) => setTemplateCode(event.target.value)}
              placeholder="template_code"
            />
          </div>
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
            Paste one credential per line. Supported formats: card key, account----password,
            account,password, account|password, account:password, JSON object lines, or a JSON array.
          </Text>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? "Importing..." : "Import credentials"}
            </Button>
            <Button type="button" variant="secondary" onClick={refresh}>
              Refresh
            </Button>
          </div>
          <MessageBox error={error} success={message} />
        </form>
      </AdminSection>

      <AdminSection title="Batches">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Name</Table.HeaderCell>
              <Table.HeaderCell>Variant</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Counts</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {batches.map((batch) => (
              <Table.Row key={batch.id}>
                <Table.Cell>{batch.name}</Table.Cell>
                <Table.Cell className="font-mono">{batch.product_variant_id}</Table.Cell>
                <Table.Cell>
                  <Badge>{batch.status}</Badge>
                </Table.Cell>
                <Table.Cell>
                  {batch.available_count} available / {batch.reserved_count} reserved /{" "}
                  {batch.sold_count} sold / {batch.total_count} total
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </AdminSection>

      <AdminSection title="Credential Items">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Label</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Variant</Table.HeaderCell>
              <Table.HeaderCell>Order</Table.HeaderCell>
              <Table.HeaderCell>Delivered</Table.HeaderCell>
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
                  <Badge>{item.status}</Badge>
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

export const config = defineRouteConfig({
  label: "Credentials",
  rank: 20,
})

export default CredentialsPage
