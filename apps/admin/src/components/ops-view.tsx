"use client"

import { useQuery } from "@tanstack/react-query"
import { formatDate, formatValue } from "@/lib/format"
import {
  loadOpsDashboard,
  loadOpsMaintenance,
  loadOpsSecurity,
  type ProductAdminOpsDashboard,
  type ProductAdminOpsSection,
} from "@/lib/product-admin-api"
import { MetricCard, Message, PageHeader, Panel, TableShell } from "./admin-page"
import { StatusBadge } from "./status-badge"

const SECTION_KEYS: Array<{
  key: keyof Pick<
    ProductAdminOpsDashboard,
    "launchReadiness" | "security" | "maintenance" | "customer" | "commerce" | "aiOps"
  >
  label: string
}> = [
  { key: "launchReadiness", label: "上线准备" },
  { key: "security", label: "安全" },
  { key: "maintenance", label: "维护" },
  { key: "customer", label: "客户访问" },
  { key: "commerce", label: "交易" },
  { key: "aiOps", label: "AI 运维" },
]

export function OpsView() {
  const dashboardQuery = useQuery({
    queryKey: ["ops-dashboard"],
    queryFn: loadOpsDashboard,
  })
  const securityQuery = useQuery({
    queryKey: ["ops-security"],
    queryFn: loadOpsSecurity,
  })
  const maintenanceQuery = useQuery({
    queryKey: ["ops-maintenance"],
    queryFn: loadOpsMaintenance,
  })
  const state = dashboardQuery.data

  return (
    <main className="px-5 py-5">
      <PageHeader
        title="运营控制"
        description="只读迁移版，用于观察生产门禁、运行风险和控制面板策略覆盖。"
        action={
          <button
            type="button"
            onClick={() => {
              void dashboardQuery.refetch()
              void securityQuery.refetch()
              void maintenanceQuery.refetch()
            }}
            className="h-9 border border-[var(--border)] bg-white px-3 text-sm font-medium hover:bg-[var(--surface-muted)]"
          >
            刷新
          </button>
        }
      />

      {dashboardQuery.error ? (
        <div className="mb-4">
          <Message tone="error">{dashboardQuery.error.message}</Message>
        </div>
      ) : null}
      {securityQuery.error ? (
        <div className="mb-4">
          <Message tone="error">{securityQuery.error.message}</Message>
        </div>
      ) : null}
      {maintenanceQuery.error ? (
        <div className="mb-4">
          <Message tone="error">{maintenanceQuery.error.message}</Message>
        </div>
      ) : null}
      {dashboardQuery.isLoading ? (
        <div className="mb-4">
          <Message tone="info">加载中</Message>
        </div>
      ) : null}

      <section className="mb-4 grid gap-3 md:grid-cols-5">
        <MetricCard
          label="状态"
          value={state?.summary.status || "unknown"}
          detail={state?.generatedAt ? formatDate(state.generatedAt) : "-"}
        />
        <MetricCard
          label="Critical"
          value={state?.summary.criticalFindings || 0}
          detail="需优先处理"
        />
        <MetricCard
          label="Warning"
          value={state?.summary.warningFindings || 0}
          detail="上线前清理"
        />
        <MetricCard
          label="Human gates"
          value={state?.summary.humanGateActions || 0}
          detail="需要人工决策"
        />
        <MetricCard
          label="Surfaces"
          value={state?.summary.controlPanelSurfaceCount || 0}
          detail={`${state?.summary.gatedSurfaceCount || 0} production gated`}
        />
      </section>

      <Panel title="发现项">
        <TableShell>
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                <th className="border-b border-[var(--border)] py-2 pr-4">级别</th>
                <th className="border-b border-[var(--border)] py-2 pr-4">发现</th>
                <th className="border-b border-[var(--border)] py-2 pr-4">Owner</th>
                <th className="border-b border-[var(--border)] py-2">动作</th>
              </tr>
            </thead>
            <tbody>
              {(state?.findings || []).map((finding) => (
                <tr key={finding.id} className="align-top">
                  <td className="border-b border-[var(--border)] py-3 pr-4">
                    <StatusBadge value={finding.severity} />
                  </td>
                  <td className="border-b border-[var(--border)] py-3 pr-4">
                    <p className="font-medium">{finding.title}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{finding.detail}</p>
                    {finding.humanGate ? (
                      <p className="mt-1 text-xs font-semibold text-[var(--danger)]">
                        human gate
                      </p>
                    ) : null}
                  </td>
                  <td className="border-b border-[var(--border)] py-3 pr-4 font-mono text-xs">
                    {finding.owner}
                  </td>
                  <td className="max-w-[28rem] border-b border-[var(--border)] py-3">
                    {finding.recommendedAction}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
        {!dashboardQuery.isLoading && !state?.findings.length ? (
          <Message tone="info">暂无发现项</Message>
        ) : null}
      </Panel>

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        {SECTION_KEYS.map(({ key, label }) => {
          const section = state?.[key]

          return (
            <Panel
              key={key}
              title={label}
              description={section ? `状态 ${section.status}` : undefined}
            >
              {section ? <SettingsTable section={section} /> : <Message tone="info">暂无数据</Message>}
            </Panel>
          )
        })}
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel
          title="Security endpoint"
          description="独立安全快照。"
        >
          {securityQuery.isLoading ? <Message tone="info">加载中</Message> : null}
          {securityQuery.data?.security ? (
            <SettingsTable section={securityQuery.data.security} />
          ) : (
            <Message tone="info">暂无数据</Message>
          )}
        </Panel>
        <Panel
          title="Maintenance endpoint"
          description="维护、客户、交易和 AI 运维快照。"
        >
          {maintenanceQuery.isLoading ? (
            <Message tone="info">加载中</Message>
          ) : null}
          <div className="grid gap-3">
            {maintenanceQuery.data ? (
              Object.entries(maintenanceQuery.data).map(([key, section]) => (
                <div
                  key={key}
                  className="rounded-[8px] border border-[var(--border)] p-3"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{key}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {formatValue(section.summary)}
                      </p>
                    </div>
                    <StatusBadge value={section.status} />
                  </div>
                  <SettingsTable section={section} />
                </div>
              ))
            ) : (
              <Message tone="info">暂无数据</Message>
            )}
          </div>
        </Panel>
      </section>
    </main>
  )
}

function SettingsTable({ section }: { section: ProductAdminOpsSection }) {
  return (
    <TableShell>
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
            <th className="border-b border-[var(--border)] py-2 pr-4">配置</th>
            <th className="border-b border-[var(--border)] py-2 pr-4">值</th>
            <th className="border-b border-[var(--border)] py-2">状态</th>
          </tr>
        </thead>
        <tbody>
          {section.settings.slice(0, 12).map((setting) => (
            <tr key={setting.key} className="align-top">
              <td className="border-b border-[var(--border)] py-3 pr-4">
                <p className="font-medium">{setting.label}</p>
                <p className="font-mono text-xs text-[var(--muted)]">{setting.key}</p>
              </td>
              <td className="border-b border-[var(--border)] py-3 pr-4">
                <p className="max-w-[18rem] truncate font-mono text-xs">
                  {setting.secret ? "redacted" : formatValue(setting.value)}
                </p>
                {setting.recommended !== undefined ? (
                  <p className="mt-1 max-w-[18rem] truncate text-xs text-[var(--muted)]">
                    推荐: {formatValue(setting.recommended)}
                  </p>
                ) : null}
              </td>
              <td className="border-b border-[var(--border)] py-3">
                <StatusBadge value={setting.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  )
}
