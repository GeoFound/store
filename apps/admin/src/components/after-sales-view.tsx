"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"
import { formatDate } from "@/lib/format"
import {
  loadAfterSales as loadAfterSalesWorkspace,
  updateAfterSale,
} from "@/lib/product-admin-api"
import {
  Field,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  TextAreaInput,
} from "./admin-controls"
import { Message, MetricCard, PageHeader, Panel, TableShell } from "./admin-page"
import { StatusBadge } from "./status-badge"

type AfterSale = {
  id: string
  delivery_id: string
  customer_email?: string | null
  reason: string
  message: string
  status: string
  result: string
  admin_note?: string | null
  created_at?: string
}

const STATUS_OPTIONS = [
  "open",
  "processing",
  "resolved",
  "rejected",
  "closed",
] as const
const RESULT_OPTIONS = [
  "pending",
  "replaced",
  "refunded",
  "rejected",
  "resolved",
] as const

async function loadAfterSales() {
  return loadAfterSalesWorkspace() as Promise<AfterSale[]>
}

export function AfterSalesView() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<AfterSale | null>(null)
  const [status, setStatus] = useState("processing")
  const [result, setResult] = useState("pending")
  const [adminNote, setAdminNote] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const afterSalesQuery = useQuery({
    queryKey: ["after-sales"],
    queryFn: loadAfterSales,
  })
  const items = afterSalesQuery.data || []

  const handle = useMutation({
    mutationFn: async () => {
      if (!selected) {
        throw new Error("请先选择一条售后请求。")
      }

      return updateAfterSale({
        id: selected.id,
        status,
        result,
        adminNote,
      })
    },
    onSuccess: async () => {
      setMessage("售后请求已更新。")
      setError("")
      setSelected(null)
      await queryClient.invalidateQueries({ queryKey: ["after-sales"] })
    },
    onError: (err) => setError(errorMessage(err)),
  })

  function select(item: AfterSale) {
    setSelected(item)
    setStatus(item.status)
    setResult(item.result)
    setAdminNote(item.admin_note || "")
    setMessage("")
    setError("")
  }

  const open = items.filter((item) =>
    ["open", "processing"].includes(item.status),
  ).length

  return (
    <main className="px-5 py-5">
      <PageHeader
        title="售后"
        description="处理交付后的售后请求（补发 / 退款 / 拒绝）。更新经由同源 BFF 转发。"
        action={
          <SecondaryButton
            type="button"
            onClick={() => void afterSalesQuery.refetch()}
          >
            刷新
          </SecondaryButton>
        }
      />

      <section className="mb-4 grid gap-3 md:grid-cols-3">
        <MetricCard label="全部" value={items.length} detail="requests" />
        <MetricCard label="待处理" value={open} detail="open / processing" />
        <MetricCard
          label="已解决"
          value={items.filter((item) => item.status === "resolved").length}
          detail="resolved"
        />
      </section>

      <div className="mb-4 grid gap-2">
        {error ? <Message tone="error">{error}</Message> : null}
        {message ? <Message tone="info">{message}</Message> : null}
        {afterSalesQuery.error ? (
          <Message tone="error">{afterSalesQuery.error.message}</Message>
        ) : null}
        {afterSalesQuery.isLoading ? <Message tone="info">加载中</Message> : null}
      </div>

      <div className="grid gap-4">
        <Panel title="售后请求">
          <AdminTable
            headers={["请求", "状态", "原因", "留言", "创建时间", "操作"]}
            empty={!afterSalesQuery.isLoading && items.length === 0}
          >
            {items.map((item) => (
              <tr key={item.id} className="align-top">
                <Cell>
                  <div className="font-mono text-xs">{item.id}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {item.customer_email || "-"}
                  </div>
                </Cell>
                <Cell>
                  <StatusBadge value={item.status} />
                </Cell>
                <Cell>{item.reason}</Cell>
                <Cell>
                  <span className="block max-w-[360px] truncate">
                    {item.message}
                  </span>
                </Cell>
                <Cell>{formatDate(item.created_at)}</Cell>
                <Cell>
                  <SecondaryButton type="button" onClick={() => select(item)}>
                    处理
                  </SecondaryButton>
                </Cell>
              </tr>
            ))}
          </AdminTable>
        </Panel>

        <Panel title="处理请求">
          {selected ? (
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                setMessage("")
                void handle.mutate()
              }}
            >
              <div className="font-mono text-sm">{selected.id}</div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="状态">
                  <SelectInput
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="处理结果">
                  <SelectInput
                    value={result}
                    onChange={(event) => setResult(event.target.value)}
                  >
                    {RESULT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              </div>
              <Field label="管理员备注">
                <TextAreaInput
                  value={adminNote}
                  onChange={(event) => setAdminNote(event.target.value)}
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <PrimaryButton type="submit" disabled={handle.isPending}>
                  {handle.isPending ? "保存中" : "保存处理结果"}
                </PrimaryButton>
                <SecondaryButton type="button" onClick={() => setSelected(null)}>
                  取消
                </SecondaryButton>
              </div>
            </form>
          ) : (
            <Message tone="info">从上方列表选择一条售后请求进行处理。</Message>
          )}
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败。"
}
