import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Heading, Input, Table, Text, Textarea } from "@medusajs/ui"
import { FormEvent, useEffect, useState } from "react"
import { AdminSection } from "../../components/admin-section"
import { MessageBox } from "../../components/message-box"
import { adminApi, formatDate } from "../../lib/admin-api"

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

const AfterSalesPage = () => {
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
      setMessage("After-sales request updated.")
      setSelected(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-4">
      <AdminSection
        title="After-sales"
        description="Review customer requests and record handling results."
      >
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Request</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Reason</Table.HeaderCell>
              <Table.HeaderCell>Message</Table.HeaderCell>
              <Table.HeaderCell>Created</Table.HeaderCell>
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
                  <Badge>{item.status}</Badge>
                </Table.Cell>
                <Table.Cell>{item.reason}</Table.Cell>
                <Table.Cell className="max-w-[360px] truncate">{item.message}</Table.Cell>
                <Table.Cell>{formatDate(item.created_at)}</Table.Cell>
                <Table.Cell>
                  <Button variant="secondary" onClick={() => selectAfterSale(item)}>
                    Handle
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </AdminSection>

      <AdminSection title="Handle Request">
        {selected ? (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <Text className="font-mono">{selected.id}</Text>
            <div className="grid gap-4 md:grid-cols-2">
              <Input value={status} onChange={(event) => setStatus(event.target.value)} />
              <Input value={result} onChange={(event) => setResult(event.target.value)} />
            </div>
            <Textarea
              value={adminNote}
              onChange={(event) => setAdminNote(event.target.value)}
              placeholder="Admin note"
            />
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save result"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setSelected(null)}>
                Cancel
              </Button>
            </div>
            <MessageBox error={error} success={message} />
          </form>
        ) : (
          <Text className="text-ui-fg-subtle">Select a request to handle.</Text>
        )}
      </AdminSection>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "After-sales",
  rank: 22,
})

export default AfterSalesPage
