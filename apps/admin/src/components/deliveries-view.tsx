"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"
import { formatDate } from "@/lib/format"
import {
  createDigitalDelivery,
  loadDeliveryWorkspace,
} from "@/lib/product-admin-api"
import {
  Field,
  PrimaryButton,
  SecondaryButton,
  TextAreaInput,
  TextInput,
} from "./admin-controls"
import { Message, MetricCard, PageHeader, Panel, TableShell } from "./admin-page"
import { StatusBadge } from "./status-badge"

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

type DeliveryForm = {
  deliveryId: string
  accountItemId: string
  orderId: string
  cartId: string
  paymentAttemptId: string
  deliveredBy: string
  deliveryNote: string
  deliveryPayload: string
}

const EMPTY_FORM: DeliveryForm = {
  deliveryId: "",
  accountItemId: "",
  orderId: "",
  cartId: "",
  paymentAttemptId: "",
  deliveredBy: "admin",
  deliveryNote: "",
  deliveryPayload: "",
}

async function loadDeliveries() {
  return loadDeliveryWorkspace() as Promise<{
    pending: PendingItem[]
    deliveries: Delivery[]
  }>
}

export function DeliveriesView() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<DeliveryForm>(EMPTY_FORM)
  const [message, setMessage] = useState("")
  const [accessToken, setAccessToken] = useState("")
  const [error, setError] = useState("")

  const deliveriesQuery = useQuery({
    queryKey: ["deliveries"],
    queryFn: loadDeliveries,
  })
  const data = deliveriesQuery.data

  const createDelivery = useMutation({
    mutationFn: async () => {
      if (!form.deliveryId.trim() && !form.accountItemId.trim()) {
        throw new Error("请先选择待交付项，或填写交付 ID / 凭证项 ID。")
      }

      return createDigitalDelivery({
        ...form,
        deliveryPayload: parseDeliveryPayload(form.deliveryPayload),
      }) as Promise<{ delivery: Delivery; accessToken: string | null }>
    },
    onSuccess: async (result) => {
      setMessage(`交付已创建：${result.delivery.id}`)
      setAccessToken(result.accessToken || "（复用已有访问令牌）")
      setError("")
      await queryClient.invalidateQueries({ queryKey: ["deliveries"] })
    },
    onError: (err) => setError(errorMessage(err)),
  })

  function selectPending(item: PendingItem) {
    const isDelivery = item.kind === "delivery"
    setForm({
      ...EMPTY_FORM,
      deliveryId: isDelivery ? item.delivery_id || item.id : "",
      accountItemId: isDelivery ? "" : item.id,
      orderId: item.order_id || "",
      cartId: item.cart_id || "",
      paymentAttemptId: item.payment_attempt_id || "",
    })
    setMessage("")
    setAccessToken("")
    setError("")
  }

  const update = (patch: Partial<DeliveryForm>) =>
    setForm((current) => ({ ...current, ...patch }))

  const fulfilled = data?.deliveries.filter((delivery) =>
    ["delivered", "fulfilled", "confirmed"].includes(delivery.delivery_status),
  )

  return (
    <main className="px-5 py-5">
      <PageHeader
        title="数字交付"
        description="为待交付凭证创建数字交付。创建交付与签发访问令牌都经由同源 BFF 转发，令牌不会暴露给浏览器脚本。"
        action={
          <SecondaryButton
            type="button"
            onClick={() => void deliveriesQuery.refetch()}
          >
            刷新
          </SecondaryButton>
        }
      />

      <section className="mb-4 grid gap-3 md:grid-cols-3">
        <MetricCard
          label="待交付"
          value={data?.pending.length || 0}
          detail="pending items"
        />
        <MetricCard
          label="交付记录"
          value={data?.deliveries.length || 0}
          detail="deliveries"
        />
        <MetricCard
          label="已完成"
          value={fulfilled?.length || 0}
          detail="delivered / confirmed"
        />
      </section>

      <div className="mb-4 grid gap-2">
        {error ? <Message tone="error">{error}</Message> : null}
        {message ? <Message tone="info">{message}</Message> : null}
        {accessToken ? (
          <Message tone="info">
            <span className="font-mono">访问令牌：{accessToken}</span>
          </Message>
        ) : null}
        {deliveriesQuery.error ? (
          <Message tone="error">{deliveriesQuery.error.message}</Message>
        ) : null}
        {deliveriesQuery.isLoading ? <Message tone="info">加载中</Message> : null}
      </div>

      <div className="grid gap-4">
        <Panel title="待交付">
          <AdminTable
            headers={["项目", "变体", "订单 / 购物车", "操作"]}
            empty={!deliveriesQuery.isLoading && (data?.pending.length || 0) === 0}
          >
            {data?.pending.map((item) => (
              <tr key={item.id} className="align-top">
                <Cell>
                  <div className="font-medium">{item.display_label}</div>
                  <div className="font-mono text-xs text-[var(--muted)]">
                    {(item.kind || "credential") + " · " + item.account_identifier}
                  </div>
                </Cell>
                <Cell mono>{item.product_variant_id}</Cell>
                <Cell mono>{item.order_id || item.cart_id || "-"}</Cell>
                <Cell>
                  <SecondaryButton
                    type="button"
                    onClick={() => selectPending(item)}
                  >
                    选择
                  </SecondaryButton>
                </Cell>
              </tr>
            ))}
          </AdminTable>
        </Panel>

        <Panel title="创建交付">
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              setMessage("")
              setAccessToken("")
              void createDelivery.mutate()
            }}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="delivery_id">
                <TextInput
                  value={form.deliveryId}
                  onChange={(event) => update({ deliveryId: event.target.value })}
                  placeholder="delivery_...（重发已有交付）"
                />
              </Field>
              <Field label="account_item_id">
                <TextInput
                  value={form.accountItemId}
                  onChange={(event) =>
                    update({ accountItemId: event.target.value })
                  }
                  placeholder="acct_item_...（凭证项）"
                />
              </Field>
              <Field label="order_id">
                <TextInput
                  value={form.orderId}
                  onChange={(event) => update({ orderId: event.target.value })}
                  placeholder="optional"
                />
              </Field>
              <Field label="cart_id">
                <TextInput
                  value={form.cartId}
                  onChange={(event) => update({ cartId: event.target.value })}
                  placeholder="optional"
                />
              </Field>
              <Field label="payment_attempt_id">
                <TextInput
                  value={form.paymentAttemptId}
                  onChange={(event) =>
                    update({ paymentAttemptId: event.target.value })
                  }
                  placeholder="optional"
                />
              </Field>
              <Field label="delivered_by">
                <TextInput
                  value={form.deliveredBy}
                  onChange={(event) =>
                    update({ deliveredBy: event.target.value })
                  }
                  placeholder="admin"
                />
              </Field>
            </div>
            <Field label="备注">
              <TextAreaInput
                value={form.deliveryNote}
                onChange={(event) =>
                  update({ deliveryNote: event.target.value })
                }
                placeholder="可选交付备注"
              />
            </Field>
            <Field label="交付内容（文本或 JSON）">
              <TextAreaInput
                value={form.deliveryPayload}
                onChange={(event) =>
                  update({ deliveryPayload: event.target.value })
                }
                placeholder='{"code":"..."} 或纯文本'
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <PrimaryButton type="submit" disabled={createDelivery.isPending}>
                {createDelivery.isPending ? "交付中" : "创建交付"}
              </PrimaryButton>
              <SecondaryButton
                type="button"
                onClick={() => setForm(EMPTY_FORM)}
              >
                清空
              </SecondaryButton>
            </div>
          </form>
        </Panel>

        <Panel title="交付记录">
          <AdminTable
            headers={["ID", "状态", "凭证项", "令牌提示", "交付时间", "确认时间"]}
            empty={
              !deliveriesQuery.isLoading && (data?.deliveries.length || 0) === 0
            }
          >
            {data?.deliveries.map((delivery) => (
              <tr key={delivery.id} className="align-top">
                <Cell mono>{delivery.id}</Cell>
                <Cell>
                  <StatusBadge value={delivery.delivery_status} />
                </Cell>
                <Cell mono>{delivery.account_item_id}</Cell>
                <Cell>{delivery.access_token_hint || "-"}</Cell>
                <Cell>{formatDate(delivery.delivered_at)}</Cell>
                <Cell>{formatDate(delivery.buyer_confirmed_at)}</Cell>
              </tr>
            ))}
          </AdminTable>
        </Panel>
      </div>
    </main>
  )
}

function AdminTable({
  headers,
  empty,
  children,
}: {
  headers: string[]
  empty: boolean
  children: ReactNode
}) {
  return (
    <>
      <TableShell>
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
              {headers.map((header) => (
                <th
                  key={header}
                  className="border-b border-[var(--border)] py-2 pr-4"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </TableShell>
      {empty ? <Message tone="info">暂无数据</Message> : null}
    </>
  )
}

function Cell({ children, mono }: { children: ReactNode; mono?: boolean }) {
  return (
    <td
      className={
        mono
          ? "border-b border-[var(--border)] py-3 pr-4 font-mono text-xs"
          : "border-b border-[var(--border)] py-3 pr-4"
      }
    >
      {children}
    </td>
  )
}

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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败。"
}
