import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Heading, Input, Table, Text, Textarea } from "@medusajs/ui"
import { FormEvent, useEffect, useState } from "react"
import { AdminSection } from "../../components/admin-section"
import { MessageBox } from "../../components/message-box"
import {
  ensureAdminExtensionsRegistered,
} from "../../extensions/defaults"
import { renderAdminExtensions } from "../../extensions/registry"
import { adminApi, formatDate } from "../../lib/admin-api"

type PendingItem = {
  id: string
  display_label: string
  account_identifier: string
  product_variant_id: string
  cart_id?: string | null
  order_id?: string | null
}

type Delivery = {
  id: string
  delivery_status: string
  account_item_id: string
  cart_id?: string | null
  payment_attempt_id?: string | null
  access_token_hint?: string
  delivered_by?: string | null
  delivered_at?: string | null
  buyer_confirmed_at?: string | null
}

const DeliveriesPage = () => {
  ensureAdminExtensionsRegistered()

  const [pending, setPending] = useState<PendingItem[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [accountItemId, setAccountItemId] = useState("")
  const [cartId, setCartId] = useState("")
  const [paymentAttemptId, setPaymentAttemptId] = useState("")
  const [deliveredBy, setDeliveredBy] = useState("admin")
  const [deliveryNote, setDeliveryNote] = useState("")
  const [lastAccessToken, setLastAccessToken] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    const [pendingData, deliveryData] = await Promise.all([
      adminApi<{ items: PendingItem[] }>("/admin/digital-delivery/pending"),
      adminApi<{ deliveries: Delivery[] }>("/admin/digital-delivery/deliveries"),
    ])
    setPending(pendingData.items)
    setDeliveries(deliveryData.deliveries)
  }

  function selectPending(item: PendingItem) {
    setAccountItemId(item.id)
    setCartId(item.cart_id || "")
    setPaymentAttemptId("")
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")
    setLastAccessToken("")

    try {
      const result = await adminApi<{
        delivery: Delivery
        accessToken: string | null
      }>("/admin/digital-delivery/deliveries", {
        method: "POST",
        body: {
          account_item_id: accountItemId,
          cart_id: cartId || undefined,
          payment_attempt_id: paymentAttemptId || undefined,
          delivered_by: deliveredBy,
          delivery_note: deliveryNote || undefined,
        },
      })
      setMessage(`Delivery created: ${result.delivery.id}`)
      setLastAccessToken(result.accessToken || "Existing delivery returned; token is not reissued.")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delivery failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-4">
      <AdminSection
        title="Pending Delivery"
        description="Sold credentials that have not been delivered."
      >
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Credential</Table.HeaderCell>
              <Table.HeaderCell>Variant</Table.HeaderCell>
              <Table.HeaderCell>Cart/Order</Table.HeaderCell>
              <Table.HeaderCell></Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {pending.map((item) => (
              <Table.Row key={item.id}>
                <Table.Cell>
                  <div>
                    <Heading level="h3">{item.display_label}</Heading>
                    <Text className="font-mono text-ui-fg-subtle">
                      {item.account_identifier}
                    </Text>
                  </div>
                </Table.Cell>
                <Table.Cell className="font-mono">{item.product_variant_id}</Table.Cell>
                <Table.Cell className="font-mono">{item.order_id || item.cart_id || "-"}</Table.Cell>
                <Table.Cell>
                  <Button variant="secondary" onClick={() => selectPending(item)}>
                    Select
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </AdminSection>

      <AdminSection title="Create Delivery">
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              value={accountItemId}
              onChange={(event) => setAccountItemId(event.target.value)}
              placeholder="account_item_id"
            />
            <Input
              value={cartId}
              onChange={(event) => setCartId(event.target.value)}
              placeholder="cart_id"
            />
            <Input
              value={paymentAttemptId}
              onChange={(event) => setPaymentAttemptId(event.target.value)}
              placeholder="payment_attempt_id"
            />
            <Input
              value={deliveredBy}
              onChange={(event) => setDeliveredBy(event.target.value)}
              placeholder="delivered_by"
            />
          </div>
          <Textarea
            value={deliveryNote}
            onChange={(event) => setDeliveryNote(event.target.value)}
            placeholder="Delivery note"
          />
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? "Delivering..." : "Create delivery"}
            </Button>
            <Button type="button" variant="secondary" onClick={refresh}>
              Refresh
            </Button>
          </div>
          <MessageBox error={error} success={message} />
          {lastAccessToken ? (
            <Text className="font-mono text-ui-fg-interactive">{lastAccessToken}</Text>
          ) : null}
        </form>
      </AdminSection>

      <AdminSection title="Deliveries">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>ID</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Credential</Table.HeaderCell>
              <Table.HeaderCell>Token Hint</Table.HeaderCell>
              <Table.HeaderCell>Delivered</Table.HeaderCell>
              <Table.HeaderCell>Confirmed</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {deliveries.map((delivery) => (
              <Table.Row key={delivery.id}>
                <Table.Cell className="font-mono">{delivery.id}</Table.Cell>
                <Table.Cell>
                  <Badge>{delivery.delivery_status}</Badge>
                </Table.Cell>
                <Table.Cell className="font-mono">{delivery.account_item_id}</Table.Cell>
                <Table.Cell>{delivery.access_token_hint || "-"}</Table.Cell>
                <Table.Cell>{formatDate(delivery.delivered_at)}</Table.Cell>
                <Table.Cell>{formatDate(delivery.buyer_confirmed_at)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </AdminSection>

      {renderAdminExtensions("deliveries.after", {}).map((entry) => (
        <div key={entry.key}>{entry.node}</div>
      ))}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Deliveries",
  rank: 21,
})

export default DeliveriesPage
