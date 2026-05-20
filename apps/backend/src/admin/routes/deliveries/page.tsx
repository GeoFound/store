import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Heading, Input, Table, Text, Textarea } from "@medusajs/ui"
import { FormEvent, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { AdminSection } from "../../components/admin-section"
import { MessageBox } from "../../components/message-box"
import {
  ensureAdminExtensionsRegistered,
} from "../../extensions/defaults"
import { renderAdminExtensions } from "../../extensions/registry"
import { adminApi, formatDate } from "../../lib/admin-api"
import { translatedStatus } from "../../lib/i18n"

type PendingItem = {
  kind?: "credential" | "delivery"
  id: string
  delivery_id?: string
  display_label: string
  account_identifier: string
  product_variant_id: string
  cart_id?: string | null
  order_id?: string | null
  payment_attempt_id?: string | null
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
  const { t } = useTranslation()

  const [pending, setPending] = useState<PendingItem[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [accountItemId, setAccountItemId] = useState("")
  const [deliveryId, setDeliveryId] = useState("")
  const [orderId, setOrderId] = useState("")
  const [cartId, setCartId] = useState("")
  const [paymentAttemptId, setPaymentAttemptId] = useState("")
  const [deliveredBy, setDeliveredBy] = useState("admin")
  const [deliveryNote, setDeliveryNote] = useState("")
  const [deliveryPayload, setDeliveryPayload] = useState("")
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
    setDeliveryId(item.kind === "delivery" ? item.delivery_id || item.id : "")
    setAccountItemId(item.kind === "delivery" ? "" : item.id)
    setOrderId(item.order_id || "")
    setCartId(item.cart_id || "")
    setPaymentAttemptId(item.payment_attempt_id || "")
    setDeliveryNote("")
    setDeliveryPayload("")
    setError("")
    setMessage("")
    setLastAccessToken("")
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
          delivery_id: deliveryId || undefined,
          account_item_id: accountItemId || undefined,
          order_id: orderId || undefined,
          cart_id: cartId || undefined,
          payment_attempt_id: paymentAttemptId || undefined,
          delivery_payload: parseDeliveryPayload(deliveryPayload),
          delivered_by: deliveredBy,
          delivery_note: deliveryNote || undefined,
        },
      })
      setMessage(t("deliveries.created", { id: result.delivery.id }))
      setLastAccessToken(result.accessToken || t("deliveries.existingToken"))
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("deliveries.deliveryFailed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-4">
      <AdminSection
        title={t("deliveries.pending")}
        description={t("deliveries.pendingDescription")}
      >
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{t("common.fields.item")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.variant")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.cartOrder")}</Table.HeaderCell>
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
                      {item.kind || "credential"} · {item.account_identifier}
                    </Text>
                  </div>
                </Table.Cell>
                <Table.Cell className="font-mono">{item.product_variant_id}</Table.Cell>
                <Table.Cell className="font-mono">{item.order_id || item.cart_id || "-"}</Table.Cell>
                <Table.Cell>
                  <Button variant="secondary" onClick={() => selectPending(item)}>
                    {t("deliveries.select")}
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </AdminSection>

      <AdminSection title={t("deliveries.create")}>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              value={deliveryId}
              onChange={(event) => setDeliveryId(event.target.value)}
              placeholder={t("deliveries.deliveryId")}
            />
            <Input
              value={accountItemId}
              onChange={(event) => setAccountItemId(event.target.value)}
              placeholder={t("deliveries.accountItemId")}
            />
            <Input
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              placeholder={t("deliveries.orderId")}
            />
            <Input
              value={cartId}
              onChange={(event) => setCartId(event.target.value)}
              placeholder={t("deliveries.cartId")}
            />
            <Input
              value={paymentAttemptId}
              onChange={(event) => setPaymentAttemptId(event.target.value)}
              placeholder={t("deliveries.paymentAttemptId")}
            />
            <Input
              value={deliveredBy}
              onChange={(event) => setDeliveredBy(event.target.value)}
              placeholder={t("deliveries.deliveredBy")}
            />
          </div>
          <Textarea
            value={deliveryNote}
            onChange={(event) => setDeliveryNote(event.target.value)}
            placeholder={t("deliveries.deliveryNote")}
          />
          <Textarea
            value={deliveryPayload}
            onChange={(event) => setDeliveryPayload(event.target.value)}
            placeholder={t("deliveries.deliveryPayload")}
          />
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? t("deliveries.delivering") : t("deliveries.createButton")}
            </Button>
            <Button type="button" variant="secondary" onClick={refresh}>
              {t("common.actions.refresh")}
            </Button>
          </div>
          <MessageBox error={error} success={message} />
          {lastAccessToken ? (
            <Text className="font-mono text-ui-fg-interactive">{lastAccessToken}</Text>
          ) : null}
        </form>
      </AdminSection>

      <AdminSection title={t("deliveries.title")}>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{t("common.fields.id")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.status")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.credential")}</Table.HeaderCell>
              <Table.HeaderCell>{t("deliveries.tokenHint")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.delivered")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.confirmed")}</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {deliveries.map((delivery) => (
              <Table.Row key={delivery.id}>
                <Table.Cell className="font-mono">{delivery.id}</Table.Cell>
                <Table.Cell>
                  <Badge>{translatedStatus(t, delivery.delivery_status)}</Badge>
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
  label: "Deliveries / 交付",
  rank: 21,
})

export default DeliveriesPage

function parseDeliveryPayload(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return undefined
  }

  if (!["{", "["].includes(trimmed[0])) {
    return trimmed
  }

  try {
    return JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    return trimmed
  }
}
