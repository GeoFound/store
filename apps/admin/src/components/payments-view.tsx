"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"
import { formatDate } from "@/lib/format"
import {
  createManualPaymentChannel,
  loadPaymentWorkspace,
  markPaymentAttemptPaid,
  togglePaymentChannel as toggleAdminPaymentChannel,
  type ProductAdminPaymentChannel,
} from "@/lib/product-admin-api"
import {
  Field,
  PrimaryButton,
  SecondaryButton,
  TextInput,
} from "./admin-controls"
import { Message, MetricCard, PageHeader, Panel, TableShell } from "./admin-page"
import { StatusBadge } from "./status-badge"

export function PaymentsView() {
  const queryClient = useQueryClient()
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [channelForm, setChannelForm] = useState({
    code: "",
    name: "",
  })
  const [markPaidForm, setMarkPaidForm] = useState({
    attemptId: "",
    note: "",
    confirmation: "",
  })
  const paymentsQuery = useQuery({
    queryKey: ["payments"],
    queryFn: loadPaymentWorkspace,
  })
  const data = paymentsQuery.data

  const createChannel = useMutation({
    mutationFn: async () => {
      if (!channelForm.code.trim() || !channelForm.name.trim()) {
        throw new Error("渠道代码和显示名称必填。")
      }

      return createManualPaymentChannel(channelForm)
    },
    onSuccess: async () => {
      setChannelForm({ code: "", name: "" })
      setMessage("支付渠道已创建。")
      setError("")
      await queryClient.invalidateQueries({ queryKey: ["payments"] })
    },
    onError: (err) => setError(errorMessage(err)),
  })

  const toggleChannel = useMutation({
    mutationFn: (channel: ProductAdminPaymentChannel) =>
      toggleAdminPaymentChannel(channel),
    onSuccess: async () => {
      setMessage("支付渠道已更新。")
      setError("")
      await queryClient.invalidateQueries({ queryKey: ["payments"] })
    },
    onError: (err) => setError(errorMessage(err)),
  })

  const markPaid = useMutation({
    mutationFn: async () => {
      if (!markPaidForm.attemptId.trim()) {
        throw new Error("支付尝试 ID 必填。")
      }

      if (markPaidForm.confirmation !== "MARK_PAID") {
        throw new Error("请输入 MARK_PAID 确认该高风险操作。")
      }

      return markPaymentAttemptPaid({
        attemptId: markPaidForm.attemptId,
        note: markPaidForm.note,
      })
    },
    onSuccess: async () => {
      setMarkPaidForm({ attemptId: "", note: "", confirmation: "" })
      setMessage("支付尝试已手动标记为已付款。")
      setError("")
      await queryClient.invalidateQueries({ queryKey: ["payments"] })
    },
    onError: (err) => setError(errorMessage(err)),
  })

  const enabledChannels =
    data?.channels.filter((channel) => channel.enabled).length || 0
  const paidAttempts =
    data?.attempts.filter((attempt) => attempt.status === "paid").length || 0

  return (
    <main className="px-5 py-5">
      <PageHeader
        title="支付"
        description="迁移后的支付控制台。渠道管理和手动确认都通过 BFF 代理执行，手动标记付款要求显式确认。"
        action={
          <SecondaryButton
            type="button"
            onClick={() => void paymentsQuery.refetch()}
          >
            刷新
          </SecondaryButton>
        }
      />

      <section className="mb-4 grid gap-3 md:grid-cols-4">
        <MetricCard
          label="支付渠道"
          value={data?.channels.length || 0}
          detail={`${enabledChannels} enabled`}
        />
        <MetricCard label="支付尝试" value={data?.attempts.length || 0} detail="recent 100" />
        <MetricCard label="已付款" value={paidAttempts} detail="paid attempts" />
        <MetricCard
          label="待处理"
          value={
            data?.attempts.filter((attempt) =>
              ["pending", "requires_action", "processing"].includes(
                attempt.status,
              ),
            ).length || 0
          }
          detail="pending-ish"
        />
      </section>

      <div className="mb-4 grid gap-2">
        {error ? <Message tone="error">{error}</Message> : null}
        {message ? <Message tone="info">{message}</Message> : null}
        {paymentsQuery.error ? (
          <Message tone="error">{paymentsQuery.error.message}</Message>
        ) : null}
        {paymentsQuery.isLoading ? <Message tone="info">加载中</Message> : null}
      </div>

      <div className="grid gap-4">
        <Panel title="支付渠道">
          <AdminTable
            headers={["渠道", "类型", "状态", "供应商", "优先级", "操作"]}
            empty={!paymentsQuery.isLoading && (data?.channels.length || 0) === 0}
          >
            {data?.channels.map((channel) => (
              <tr key={channel.id} className="align-top">
                <Cell>
                  <p className="font-medium">{channel.displayName}</p>
                  <p className="font-mono text-xs text-[var(--muted)]">
                    {channel.code}
                  </p>
                </Cell>
                <Cell>{channel.type}</Cell>
                <Cell>
                  <StatusBadge
                    value={channel.enabled ? channel.healthStatus : "disabled"}
                  />
                </Cell>
                <Cell mono>{channel.providerCode}</Cell>
                <Cell>{channel.priority}</Cell>
                <Cell>
                  <SecondaryButton
                    type="button"
                    disabled={toggleChannel.isPending}
                    onClick={() => {
                      setMessage("")
                      void toggleChannel.mutate(channel)
                    }}
                  >
                    {channel.enabled ? "停用" : "启用"}
                  </SecondaryButton>
                </Cell>
              </tr>
            ))}
          </AdminTable>
        </Panel>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="创建手动支付渠道">
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                setMessage("")
                void createChannel.mutate()
              }}
            >
              <Field label="渠道代码">
                <TextInput
                  value={channelForm.code}
                  onChange={(event) =>
                    setChannelForm((current) => ({
                      ...current,
                      code: event.target.value,
                    }))
                  }
                  placeholder="manual"
                />
              </Field>
              <Field label="显示名称">
                <TextInput
                  value={channelForm.name}
                  onChange={(event) =>
                    setChannelForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Manual payment"
                />
              </Field>
              <PrimaryButton type="submit" disabled={createChannel.isPending}>
                创建渠道
              </PrimaryButton>
            </form>
          </Panel>

          <Panel
            title="手动确认付款"
            description="高风险操作：会最终化支付尝试并写入审计日志。"
          >
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                setMessage("")
                void markPaid.mutate()
              }}
            >
              <Field label="支付尝试 ID">
                <TextInput
                  value={markPaidForm.attemptId}
                  onChange={(event) =>
                    setMarkPaidForm((current) => ({
                      ...current,
                      attemptId: event.target.value,
                    }))
                  }
                  placeholder="payatt_..."
                />
              </Field>
              <Field label="备注">
                <TextInput
                  value={markPaidForm.note}
                  onChange={(event) =>
                    setMarkPaidForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                  placeholder="人工核验来源"
                />
              </Field>
              <Field label="确认词">
                <TextInput
                  value={markPaidForm.confirmation}
                  onChange={(event) =>
                    setMarkPaidForm((current) => ({
                      ...current,
                      confirmation: event.target.value,
                    }))
                  }
                  placeholder="MARK_PAID"
                />
              </Field>
              <PrimaryButton
                type="submit"
                disabled={
                  markPaid.isPending ||
                  !markPaidForm.attemptId ||
                  markPaidForm.confirmation !== "MARK_PAID"
                }
              >
                标记已付款
              </PrimaryButton>
            </form>
          </Panel>
        </div>

        <Panel title="支付尝试">
          <AdminTable
            headers={["ID", "状态", "金额", "供应商", "供应商订单", "创建", "操作"]}
            empty={!paymentsQuery.isLoading && (data?.attempts.length || 0) === 0}
          >
            {data?.attempts.map((attempt) => (
              <tr key={attempt.id} className="align-top">
                <Cell mono>{attempt.id}</Cell>
                <Cell>
                  <StatusBadge value={attempt.status} />
                </Cell>
                <Cell>
                  {formatAmount(attempt.amount)} {attempt.currency}
                </Cell>
                <Cell mono>{attempt.providerCode}</Cell>
                <Cell mono>{attempt.providerOrderId || "-"}</Cell>
                <Cell>{formatDate(attempt.createdAt)}</Cell>
                <Cell>
                  <SecondaryButton
                    type="button"
                    disabled={attempt.status === "paid"}
                    onClick={() => {
                      setMessage("")
                      setMarkPaidForm({
                        attemptId: attempt.id,
                        note: "",
                        confirmation: "",
                      })
                    }}
                  >
                    填入确认
                  </SecondaryButton>
                </Cell>
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

function Cell({
  children,
  mono,
}: {
  children: ReactNode
  mono?: boolean
}) {
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

function formatAmount(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2,
  }).format(value)
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败。"
}
