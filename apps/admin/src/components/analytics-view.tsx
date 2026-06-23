"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { formatDate } from "@/lib/format"
import {
  loadAnalyticsDispatches,
  loadAnalyticsEvents,
  replayAnalyticsDispatch,
} from "@/lib/product-admin-api"
import { MetricCard, Message, PageHeader, Panel, TableShell } from "./admin-page"
import { SecondaryButton } from "./admin-controls"
import { StatusBadge } from "./status-badge"

type AnalyticsEvent = {
  id: string
  event_name: string
  source: string
  status: string
  order_id?: string | null
  payment_attempt_id?: string | null
  created_at?: string
}

type AnalyticsDispatch = {
  id: string
  event_id: string
  destination_code: string
  status: string
  attempt_count: number
  next_retry_at?: string | null
  delivered_at?: string | null
  error_message?: string | null
  created_at?: string
}

export function AnalyticsView() {
  const queryClient = useQueryClient()
  const eventsQuery = useQuery({
    queryKey: ["analytics-events"],
    queryFn: () =>
      loadAnalyticsEvents() as Promise<{ events: AnalyticsEvent[] }>,
  })
  const dispatchesQuery = useQuery({
    queryKey: ["analytics-dispatches"],
    queryFn: () =>
      loadAnalyticsDispatches() as Promise<{
        dispatches: AnalyticsDispatch[]
      }>,
  })
  const events = eventsQuery.data?.events || []
  const dispatches = dispatchesQuery.data?.dispatches || []
  const failedDispatches = dispatches.filter((item) =>
    ["failed", "dead"].includes(item.status),
  )
  const replayDispatch = useMutation({
    mutationFn: (dispatchId: string) => replayAnalyticsDispatch(dispatchId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["analytics-dispatches"] }),
  })

  return (
    <main className="px-5 py-5">
      <PageHeader
        title="分析事件"
        description="展示事件、派发队列和可审计重放操作。所有读写经由同源 BFF 转发。"
        action={
          <button
            type="button"
            onClick={() => {
              void eventsQuery.refetch()
              void dispatchesQuery.refetch()
            }}
            className="h-9 border border-[var(--border)] bg-white px-3 text-sm font-medium hover:bg-[var(--surface-muted)]"
          >
            刷新
          </button>
        }
      />

      <section className="mb-4 grid gap-3 md:grid-cols-3">
        <MetricCard label="事件" value={events.length} detail="最近 100 条" />
        <MetricCard label="派发" value={dispatches.length} detail="最近 100 条" />
        <MetricCard label="异常派发" value={failedDispatches.length} detail="failed / dead" />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="事件流">
          {eventsQuery.error ? (
            <Message tone="error">{eventsQuery.error.message}</Message>
          ) : null}
          {eventsQuery.isLoading ? <Message tone="info">加载中</Message> : null}
          <TableShell>
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                  <th className="border-b border-[var(--border)] py-2 pr-4">事件</th>
                  <th className="border-b border-[var(--border)] py-2 pr-4">状态</th>
                  <th className="border-b border-[var(--border)] py-2 pr-4">来源</th>
                  <th className="border-b border-[var(--border)] py-2">创建</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="align-top">
                    <td className="border-b border-[var(--border)] py-3 pr-4">
                      <p className="font-medium">{event.event_name}</p>
                      <p className="font-mono text-xs text-[var(--muted)]">{event.id}</p>
                    </td>
                    <td className="border-b border-[var(--border)] py-3 pr-4">
                      <StatusBadge value={event.status} />
                    </td>
                    <td className="border-b border-[var(--border)] py-3 pr-4">
                      {event.source}
                    </td>
                    <td className="border-b border-[var(--border)] py-3">
                      {formatDate(event.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
          {!eventsQuery.isLoading && events.length === 0 ? (
            <Message tone="info">暂无事件</Message>
          ) : null}
        </Panel>

        <Panel title="派发队列">
          {dispatchesQuery.error ? (
            <Message tone="error">{dispatchesQuery.error.message}</Message>
          ) : null}
          {replayDispatch.error ? (
            <Message tone="error">{replayDispatch.error.message}</Message>
          ) : null}
          {dispatchesQuery.isLoading ? <Message tone="info">加载中</Message> : null}
          <TableShell>
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                  <th className="border-b border-[var(--border)] py-2 pr-4">目标</th>
                  <th className="border-b border-[var(--border)] py-2 pr-4">状态</th>
                  <th className="border-b border-[var(--border)] py-2 pr-4">次数</th>
                  <th className="border-b border-[var(--border)] py-2 pr-4">错误</th>
                  <th className="border-b border-[var(--border)] py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {dispatches.map((dispatch) => (
                  <tr key={dispatch.id} className="align-top">
                    <td className="border-b border-[var(--border)] py-3 pr-4">
                      <p className="font-medium">{dispatch.destination_code}</p>
                      <p className="font-mono text-xs text-[var(--muted)]">{dispatch.id}</p>
                    </td>
                    <td className="border-b border-[var(--border)] py-3 pr-4">
                      <StatusBadge value={dispatch.status} />
                    </td>
                    <td className="border-b border-[var(--border)] py-3 pr-4">
                      {dispatch.attempt_count}
                    </td>
                    <td className="max-w-[22rem] border-b border-[var(--border)] py-3">
                      <p className="truncate text-[var(--muted)]">
                        {dispatch.error_message || "-"}
                      </p>
                    </td>
                    <td className="border-b border-[var(--border)] py-3">
                      <SecondaryButton
                        type="button"
                        disabled={replayDispatch.isPending}
                        onClick={() => replayDispatch.mutate(dispatch.id)}
                      >
                        重放
                      </SecondaryButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
          {!dispatchesQuery.isLoading && dispatches.length === 0 ? (
            <Message tone="info">暂无派发记录</Message>
          ) : null}
        </Panel>
      </div>
    </main>
  )
}
