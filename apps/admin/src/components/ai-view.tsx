"use client"

import { useQuery } from "@tanstack/react-query"
import { formatDate } from "@/lib/format"
import {
  loadAIPolicy,
  loadAIProviders,
  loadAIRuns,
} from "@/lib/product-admin-api"
import { MetricCard, Message, PageHeader, Panel, TableShell } from "./admin-page"
import { StatusBadge } from "./status-badge"

export function AIView() {
  const providersQuery = useQuery({
    queryKey: ["ai-providers"],
    queryFn: loadAIProviders,
  })
  const policyQuery = useQuery({
    queryKey: ["ai-policy"],
    queryFn: loadAIPolicy,
  })
  const runsQuery = useQuery({
    queryKey: ["ai-runs"],
    queryFn: loadAIRuns,
  })
  const state = providersQuery.data
  const policy = policyQuery.data?.policy
  const taskRuns = runsQuery.data?.runs || state?.taskRuns || []

  return (
    <main className="px-5 py-5">
      <PageHeader
        title="AI 状态"
        description="读取 provider、任务插件、最近运行和控制面板准入策略。"
        action={
          <button
            type="button"
            onClick={() => {
              void providersQuery.refetch()
              void policyQuery.refetch()
              void runsQuery.refetch()
            }}
            className="h-9 border border-[var(--border)] bg-white px-3 text-sm font-medium hover:bg-[var(--surface-muted)]"
          >
            刷新
          </button>
        }
      />

      {providersQuery.error ? (
        <div className="mb-4">
          <Message tone="error">{providersQuery.error.message}</Message>
        </div>
      ) : null}
      {runsQuery.error ? (
        <div className="mb-4">
          <Message tone="error">{runsQuery.error.message}</Message>
        </div>
      ) : null}

      <section className="mb-4 grid gap-3 md:grid-cols-4">
        <MetricCard
          label="运行时"
          value={state?.enabled ? "启用" : "禁用"}
          detail={state?.defaultProviderCode || "无默认 provider"}
        />
        <MetricCard
          label="Provider"
          value={state?.summary.providerCount || 0}
          detail={`${state?.summary.configuredProviderCount || 0} 已配置`}
        />
        <MetricCard
          label="需关注"
          value={state?.summary.attentionProviderCount || 0}
          detail="provider issue"
        />
        <MetricCard
          label="Review run"
          value={
            taskRuns.filter((run) =>
              ["requires_review", "pending_review"].includes(run.status),
            ).length || state?.summary.reviewRunCount || 0
          }
          detail={`${taskRuns.length} recent runs`}
        />
      </section>

      <Panel title="Provider">
        {providersQuery.isLoading ? <Message tone="info">加载中</Message> : null}
        <TableShell>
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                <th className="border-b border-[var(--border)] py-2 pr-4">名称</th>
                <th className="border-b border-[var(--border)] py-2 pr-4">协议</th>
                <th className="border-b border-[var(--border)] py-2 pr-4">模型</th>
                <th className="border-b border-[var(--border)] py-2 pr-4">密钥</th>
                <th className="border-b border-[var(--border)] py-2">状态</th>
              </tr>
            </thead>
            <tbody>
              {(state?.providers || []).map((provider) => (
                <tr key={provider.code} className="align-top">
                  <td className="border-b border-[var(--border)] py-3 pr-4">
                    <p className="font-medium">{provider.label}</p>
                    <p className="font-mono text-xs text-[var(--muted)]">{provider.code}</p>
                    <p className="text-xs text-[var(--muted)]">{provider.providerKind}</p>
                  </td>
                  <td className="border-b border-[var(--border)] py-3 pr-4 font-mono text-xs">
                    {provider.protocol}
                  </td>
                  <td className="border-b border-[var(--border)] py-3 pr-4 font-mono text-xs">
                    {provider.defaultModel || "-"}
                  </td>
                  <td className="border-b border-[var(--border)] py-3 pr-4">
                    {provider.requiresApiKey ? (
                      <StatusBadge
                        value={provider.apiKeyConfigured ? "configured" : "missing"}
                      />
                    ) : (
                      <span className="text-sm text-[var(--muted)]">不需要</span>
                    )}
                  </td>
                  <td className="border-b border-[var(--border)] py-3">
                    <StatusBadge value={provider.status} />
                    {provider.issues.slice(0, 2).map((issue) => (
                      <p key={issue} className="mt-1 max-w-[24rem] truncate text-xs text-[var(--danger)]">
                        {issue}
                      </p>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="任务插件">
          <div className="grid gap-2">
            {(state?.taskPlugins || []).map((plugin) => (
              <div
                key={plugin.code}
                className="rounded-[8px] border border-[var(--border)] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{plugin.title}</p>
                    <p className="font-mono text-xs text-[var(--muted)]">
                      {plugin.code} / {plugin.taskType}
                    </p>
                  </div>
                  <StatusBadge value={plugin.runnable ? "active" : "disabled"} />
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {plugin.requiredCapabilities.join(", ") || "无能力要求"}
                </p>
              </div>
            ))}
            {!providersQuery.isLoading && !state?.taskPlugins.length ? (
              <Message tone="info">暂无任务插件</Message>
            ) : null}
          </div>
        </Panel>

        <Panel title="最近运行">
          {runsQuery.isLoading ? <Message tone="info">加载中</Message> : null}
          <div className="grid gap-2">
            {taskRuns.slice(0, 12).map((run) => (
              <div key={run.id} className="rounded-[8px] border border-[var(--border)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{run.taskType}</p>
                    <p className="font-mono text-xs text-[var(--muted)]">{run.id}</p>
                  </div>
                  <StatusBadge value={run.status} />
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {run.providerCode || "-"} / {formatDate(run.createdAt)}
                </p>
                {run.errorMessage ? (
                  <p className="mt-1 truncate text-xs text-[var(--danger)]">
                    {run.errorMessage}
                  </p>
                ) : null}
              </div>
            ))}
            {!runsQuery.isLoading && !taskRuns.length ? (
              <Message tone="info">暂无运行记录</Message>
            ) : null}
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="控制面板策略" description={policy?.purpose}>
          {policyQuery.error ? <Message tone="error">{policyQuery.error.message}</Message> : null}
          {policyQuery.isLoading ? <Message tone="info">加载中</Message> : null}
          <div className="grid gap-3 md:grid-cols-2">
            {(policy?.admissionCriteria || []).map((item) => (
              <div key={item.id} className="rounded-[8px] border border-[var(--border)] p-3">
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{item.description}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </main>
  )
}
