"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo, useState, type FormEvent } from "react"
import { formatDate } from "@/lib/format"
import { loadAuditLogs } from "@/lib/product-admin-api"
import { Message, PageHeader, Panel, TableShell } from "./admin-page"
import { StatusBadge } from "./status-badge"

type AuditLog = {
  id: string
  actor_type: string
  actor_id?: string | null
  action: string
  entity_type: string
  entity_id?: string | null
  risk_level: string
  metadata_json?: Record<string, unknown> | null
  created_at?: string
}

export function AuditLogsView() {
  const [filters, setFilters] = useState({
    action: "",
    entityType: "",
    entityId: "",
  })
  const [appliedFilters, setAppliedFilters] = useState(filters)
  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: "100" })

    if (appliedFilters.action) {
      params.set("action", appliedFilters.action)
    }
    if (appliedFilters.entityType) {
      params.set("entity_type", appliedFilters.entityType)
    }
    if (appliedFilters.entityId) {
      params.set("entity_id", appliedFilters.entityId)
    }

    return params.toString()
  }, [appliedFilters])
  const logsQuery = useQuery({
    queryKey: ["audit-logs", query],
    queryFn: () => loadAuditLogs(query) as Promise<{ audit_logs: AuditLog[] }>,
  })
  const logs = logsQuery.data?.audit_logs || []

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAppliedFilters(filters)
  }

  return (
    <main className="px-5 py-5">
      <PageHeader
        title="审计日志"
        description="迁移后的只读审计视图，通过 Next BFF 读取 Medusa /admin/audit-logs。"
        action={
          <button
            type="button"
            onClick={() => void logsQuery.refetch()}
            className="h-9 border border-[var(--border)] bg-white px-3 text-sm font-medium hover:bg-[var(--surface-muted)]"
          >
            刷新
          </button>
        }
      />

      <Panel title="过滤">
        <form onSubmit={apply} className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-3">
            <input
              value={filters.action}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  action: event.target.value,
                }))
              }
              placeholder="action"
              className="h-10 border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
            />
            <input
              value={filters.entityType}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  entityType: event.target.value,
                }))
              }
              placeholder="entity_type"
              className="h-10 border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
            />
            <input
              value={filters.entityId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  entityId: event.target.value,
                }))
              }
              placeholder="entity_id"
              className="h-10 border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="h-9 bg-[var(--accent)] px-3 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
            >
              应用
            </button>
            <button
              type="button"
              onClick={() => {
                const empty = { action: "", entityType: "", entityId: "" }
                setFilters(empty)
                setAppliedFilters(empty)
              }}
              className="h-9 border border-[var(--border)] bg-white px-3 text-sm font-medium hover:bg-[var(--surface-muted)]"
            >
              清空
            </button>
          </div>
        </form>
      </Panel>

      <div className="mt-4">
        <Panel title="日志" description={`当前显示 ${logs.length} 条`}>
          {logsQuery.error ? (
            <Message tone="error">{logsQuery.error.message}</Message>
          ) : null}
          {logsQuery.isLoading ? <Message tone="info">加载中</Message> : null}
          <TableShell>
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                  <th className="border-b border-[var(--border)] py-2 pr-4">时间</th>
                  <th className="border-b border-[var(--border)] py-2 pr-4">动作</th>
                  <th className="border-b border-[var(--border)] py-2 pr-4">风险</th>
                  <th className="border-b border-[var(--border)] py-2 pr-4">角色</th>
                  <th className="border-b border-[var(--border)] py-2 pr-4">实体</th>
                  <th className="border-b border-[var(--border)] py-2">元数据</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="align-top">
                    <td className="border-b border-[var(--border)] py-3 pr-4 whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="border-b border-[var(--border)] py-3 pr-4 font-medium">
                      {log.action}
                    </td>
                    <td className="border-b border-[var(--border)] py-3 pr-4">
                      <StatusBadge value={log.risk_level} />
                    </td>
                    <td className="border-b border-[var(--border)] py-3 pr-4">
                      <span className="font-mono text-xs">{log.actor_type}</span>
                      {log.actor_id ? (
                        <span className="ml-1 font-mono text-xs text-[var(--muted)]">
                          {log.actor_id}
                        </span>
                      ) : null}
                    </td>
                    <td className="border-b border-[var(--border)] py-3 pr-4 font-mono text-xs">
                      {log.entity_type}:{log.entity_id || "-"}
                    </td>
                    <td className="max-w-[28rem] border-b border-[var(--border)] py-3">
                      <p className="truncate font-mono text-xs text-[var(--muted)]">
                        {log.metadata_json ? JSON.stringify(log.metadata_json) : "-"}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
          {!logsQuery.isLoading && logs.length === 0 ? (
            <Message tone="info">暂无审计日志</Message>
          ) : null}
        </Panel>
      </div>
    </main>
  )
}
