"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { adminApi } from "@/lib/admin-api"
import { formatDate, formatValue } from "@/lib/format"
import {
  Field,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  TextAreaInput,
  TextInput,
} from "./admin-controls"
import { Message, MetricCard, PageHeader, Panel } from "./admin-page"
import { AdminTable, Cell, normalizeError } from "./admin-table"
import { StatusBadge } from "./status-badge"

type OrderLineItem = {
  id: string
  title?: string | null
  subtitle?: string | null
  quantity?: number | null
  unit_price?: number | null
  total?: number | null
}

type OrderCustomer = {
  id?: string
  email?: string | null
  first_name?: string | null
  last_name?: string | null
}

type Order = {
  id: string
  display_id?: number | string | null
  email?: string | null
  status?: string | null
  payment_status?: string | null
  fulfillment_status?: string | null
  total?: number | null
  currency_code?: string | null
  customer?: OrderCustomer | null
  items?: OrderLineItem[]
  payment_collections?: Array<{
    id: string
    status?: string | null
    amount?: number | null
  }>
  fulfillments?: Array<{
    id: string
    status?: string | null
    delivered_at?: string | null
  }>
  created_at?: string | null
  updated_at?: string | null
}

type OrderAction = "complete" | "archive" | "cancel"

type OrderActionForm = {
  orderId: string
  action: OrderAction
  confirmText: string
  note: string
}

const EMPTY_ACTION_FORM: OrderActionForm = {
  orderId: "",
  action: "complete",
  confirmText: "",
  note: "",
}

async function loadOrders(query: string) {
  const params = new URLSearchParams({
    limit: "50",
    order: "-created_at",
    fields:
      "id,display_id,email,status,payment_status,fulfillment_status,total,currency_code,customer.*,items.*,payment_collections.*,fulfillments.*,created_at,updated_at",
  })

  if (query.trim()) {
    params.set("q", query.trim())
  }

  const data = await adminApi<{ orders: Order[]; count?: number }>(
    `/admin/orders?${params.toString()}`,
  )

  return {
    orders: data.orders || [],
    count: data.count || data.orders?.length || 0,
  }
}

async function retrieveOrder(orderId: string) {
  const data = await adminApi<{ order: Order }>(
    `/admin/orders/${orderId}?fields=id,display_id,email,status,payment_status,fulfillment_status,total,currency_code,customer.*,items.*,payment_collections.*,fulfillments.*,created_at,updated_at`,
  )

  return data.order
}

export function OrdersView() {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState("")
  const [queryDraft, setQueryDraft] = useState("")
  const [selectedOrderId, setSelectedOrderId] = useState("")
  const [actionForm, setActionForm] =
    useState<OrderActionForm>(EMPTY_ACTION_FORM)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const ordersQuery = useQuery({
    queryKey: ["orders", query],
    queryFn: () => loadOrders(query),
  })
  const selectedOrderQuery = useQuery({
    queryKey: ["orders", "detail", selectedOrderId],
    queryFn: () => retrieveOrder(selectedOrderId),
    enabled: Boolean(selectedOrderId),
  })
  const orders = ordersQuery.data?.orders || []

  const runAction = useMutation({
    mutationFn: async () => {
      const orderId = actionForm.orderId.trim()

      if (!orderId) {
        throw new Error("请选择或填写订单 ID。")
      }

      if (actionForm.action === "cancel" && actionForm.confirmText !== orderId) {
        throw new Error("取消订单必须在确认框中输入完整订单 ID。")
      }

      const noteBody =
        actionForm.note.trim() && actionForm.action !== "archive"
          ? { metadata: { operator_note: actionForm.note.trim() } }
          : undefined

      await adminApi(`/admin/orders/${orderId}/${actionForm.action}`, {
        method: "POST",
        ...(noteBody ? { body: noteBody } : {}),
      })
    },
    onSuccess: async () => {
      setMessage("订单操作已提交。")
      setError("")
      setActionForm(EMPTY_ACTION_FORM)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["orders", "detail"] }),
      ])
    },
    onError: (err) => setError(normalizeError(err)),
  })

  const summary = {
    orders: orders.length,
    completed: orders.filter((order) => order.status === "completed").length,
    canceled: orders.filter((order) => order.status === "canceled").length,
    open: orders.filter(
      (order) => !["completed", "canceled"].includes(String(order.status)),
    ).length,
  }

  return (
    <main className="px-5 py-5">
      <PageHeader
        title="订单"
        description="独立后台订单控制面，覆盖订单调查、支付/履约状态、订单详情和受控操作。"
        action={
          <SecondaryButton type="button" onClick={() => void ordersQuery.refetch()}>
            刷新
          </SecondaryButton>
        }
      />

      <section className="mb-4 grid gap-3 md:grid-cols-4">
        <MetricCard label="订单" value={summary.orders} detail="当前查询" />
        <MetricCard label="处理中" value={summary.open} detail="open" />
        <MetricCard label="已完成" value={summary.completed} detail="completed" />
        <MetricCard label="已取消" value={summary.canceled} detail="canceled" />
      </section>

      <div className="mb-4 grid gap-2">
        {error ? <Message tone="error">{error}</Message> : null}
        {message ? <Message tone="info">{message}</Message> : null}
        {ordersQuery.error ? (
          <Message tone="error">{ordersQuery.error.message}</Message>
        ) : null}
        {selectedOrderQuery.error ? (
          <Message tone="error">{selectedOrderQuery.error.message}</Message>
        ) : null}
        {ordersQuery.isLoading ? <Message tone="info">加载中</Message> : null}
      </div>

      <div className="grid gap-4">
        <Panel title="筛选">
          <form
            className="flex flex-col gap-3 md:flex-row md:items-end"
            onSubmit={(event) => {
              event.preventDefault()
              setQuery(queryDraft)
            }}
          >
            <div className="min-w-0 flex-1">
              <Field label="搜索">
                <TextInput
                  value={queryDraft}
                  onChange={(event) => setQueryDraft(event.target.value)}
                  placeholder="订单号、邮箱、客户"
                />
              </Field>
            </div>
            <div className="flex gap-2">
              <PrimaryButton type="submit">应用</PrimaryButton>
              <SecondaryButton
                type="button"
                onClick={() => {
                  setQuery("")
                  setQueryDraft("")
                }}
              >
                清空
              </SecondaryButton>
            </div>
          </form>
        </Panel>

        <Panel title="订单操作" description="取消订单会影响客户和履约，必须输入完整订单 ID 才能提交。">
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              setMessage("")
              void runAction.mutate()
            }}
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label="订单 ID">
                <TextInput
                  value={actionForm.orderId}
                  onChange={(event) =>
                    setActionForm((current) => ({
                      ...current,
                      orderId: event.target.value,
                    }))
                  }
                  placeholder="order_..."
                />
              </Field>
              <Field label="动作">
                <SelectInput
                  value={actionForm.action}
                  onChange={(event) =>
                    setActionForm((current) => ({
                      ...current,
                      action: event.target.value as OrderAction,
                    }))
                  }
                >
                  <option value="complete">complete</option>
                  <option value="archive">archive</option>
                  <option value="cancel">cancel</option>
                </SelectInput>
              </Field>
              <Field label="取消确认">
                <TextInput
                  value={actionForm.confirmText}
                  onChange={(event) =>
                    setActionForm((current) => ({
                      ...current,
                      confirmText: event.target.value,
                    }))
                  }
                  placeholder="取消时输入完整订单 ID"
                />
              </Field>
            </div>
            <Field label="操作备注">
              <TextAreaInput
                value={actionForm.note}
                onChange={(event) =>
                  setActionForm((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
              />
            </Field>
            <div>
              <PrimaryButton type="submit" disabled={runAction.isPending}>
                {runAction.isPending ? "提交中" : "提交订单操作"}
              </PrimaryButton>
            </div>
          </form>
        </Panel>

        <Panel title="订单列表">
          <AdminTable
            headers={["订单", "客户", "金额", "支付", "履约", "创建", "操作"]}
            empty={!ordersQuery.isLoading && orders.length === 0}
          >
            {orders.map((order) => (
              <tr key={order.id} className="align-top">
                <Cell>
                  <div className="font-medium">#{order.display_id || order.id}</div>
                  <div className="font-mono text-xs text-[var(--muted)]">
                    {order.id}
                  </div>
                  <div className="mt-1">
                    <StatusBadge value={order.status} />
                  </div>
                </Cell>
                <Cell>
                  <div>{order.email || order.customer?.email || "-"}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {customerName(order.customer)}
                  </div>
                </Cell>
                <Cell mono>{money(order.total, order.currency_code)}</Cell>
                <Cell>
                  <StatusBadge value={order.payment_status} />
                </Cell>
                <Cell>
                  <StatusBadge value={order.fulfillment_status} />
                </Cell>
                <Cell>{formatDate(order.created_at)}</Cell>
                <Cell align="right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <SecondaryButton
                      type="button"
                      onClick={() => {
                        setSelectedOrderId(order.id)
                        setActionForm((current) => ({
                          ...current,
                          orderId: order.id,
                        }))
                      }}
                    >
                      查看
                    </SecondaryButton>
                    <SecondaryButton
                      type="button"
                      onClick={() =>
                        setActionForm({
                          orderId: order.id,
                          action: "complete",
                          confirmText: "",
                          note: "",
                        })
                      }
                    >
                      准备完成
                    </SecondaryButton>
                  </div>
                </Cell>
              </tr>
            ))}
          </AdminTable>
        </Panel>

        <Panel title="订单详情">
          {selectedOrderQuery.isLoading ? <Message tone="info">加载中</Message> : null}
          {selectedOrderQuery.data ? (
            <OrderDetail order={selectedOrderQuery.data} />
          ) : (
            <Message tone="info">选择一条订单查看详情。</Message>
          )}
        </Panel>
      </div>
    </main>
  )
}

function OrderDetail({ order }: { order: Order }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="订单状态" value={order.status || "unknown"} detail={order.id} />
        <MetricCard
          label="支付"
          value={order.payment_status || "unknown"}
          detail={`${order.payment_collections?.length || 0} collections`}
        />
        <MetricCard
          label="履约"
          value={order.fulfillment_status || "unknown"}
          detail={`${order.fulfillments?.length || 0} fulfillments`}
        />
      </div>
      <AdminTable
        headers={["商品", "数量", "单价", "小计"]}
        empty={(order.items || []).length === 0}
      >
        {(order.items || []).map((item) => (
          <tr key={item.id} className="align-top">
            <Cell>
              <div className="font-medium">{item.title || item.id}</div>
              <div className="text-xs text-[var(--muted)]">
                {item.subtitle || item.id}
              </div>
            </Cell>
            <Cell>{formatValue(item.quantity)}</Cell>
            <Cell mono>{money(item.unit_price, order.currency_code)}</Cell>
            <Cell mono>{money(item.total, order.currency_code)}</Cell>
          </tr>
        ))}
      </AdminTable>
      <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-muted)] p-3">
        <div className="grid gap-1 text-sm">
          <div>
            <span className="font-medium">客户：</span>
            {order.email || order.customer?.email || "-"} {customerName(order.customer)}
          </div>
          <div>
            <span className="font-medium">创建：</span>
            {formatDate(order.created_at)}
          </div>
          <div>
            <span className="font-medium">更新：</span>
            {formatDate(order.updated_at)}
          </div>
        </div>
      </div>
    </div>
  )
}

function money(value?: number | null, currency?: string | null) {
  if (typeof value !== "number") {
    return "-"
  }

  return `${currency || ""} ${value}`
}

function customerName(customer?: OrderCustomer | null) {
  const name = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ")

  return name || customer?.id || ""
}
