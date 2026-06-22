"use client"

import { useQuery } from "@tanstack/react-query"
import { adminApi } from "@/lib/admin-api"
import { formatDate } from "@/lib/format"
import { MetricCard, Message, PageHeader, Panel, TableShell } from "./admin-page"
import { StatusBadge } from "./status-badge"

type AIProviderConfig = {
  code: string
  label: string
  provider_kind: string
  protocol: string
  base_url: string | null
  default_model: string | null
  capabilities: string[]
  api_key_env: string | null
  api_key_configured: boolean
  requires_api_key: boolean
  enabled: boolean
  status: string
  issues: string[]
}

type AITaskPlugin = {
  code: string
  task_type: string
  title: string
  required_capabilities: string[]
  requires_human_review: boolean
  runnable: boolean
}

type AITaskRun = {
  id: string
  task_type: string
  plugin_code: string
  provider_code: string | null
  site_id: string | null
  status: string
  input_summary: string | null
  output_summary: string | null
  error_message: string | null
  created_at: string | null
}

type AIProvidersResponse = {
  enabled: boolean
  default_provider_code: string | null
  providers: AIProviderConfig[]
  task_plugins: AITaskPlugin[]
  task_runs: AITaskRun[]
  issues: string[]
  summary: {
    provider_count: number
    configured_provider_count: number
    attention_provider_count: number
    review_run_count: number
  }
}

type AIPolicy = {
  version: string
  purpose: string
  admissionCriteria: Array<{
    id: string
    title: string
    description: string
  }>
  requiredSurface: Array<{
    id: string
    title: string
    description: string
  }>
}

export function AIView() {
  const providersQuery = useQuery({
    queryKey: ["ai-providers"],
    queryFn: () => adminApi<AIProvidersResponse>("/admin/ai/providers"),
  })
  const policyQuery = useQuery({
    queryKey: ["ai-policy"],
    queryFn: () =>
      adminApi<{ policy: AIPolicy }>("/admin/ai/control-panel-policy"),
  })
  const state = providersQuery.data
  const policy = policyQuery.data?.policy

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

      <section className="mb-4 grid gap-3 md:grid-cols-4">
        <MetricCard
          label="运行时"
          value={state?.enabled ? "启用" : "禁用"}
          detail={state?.default_provider_code || "无默认 provider"}
        />
        <MetricCard
          label="Provider"
          value={state?.summary.provider_count || 0}
          detail={`${state?.summary.configured_provider_count || 0} 已配置`}
        />
        <MetricCard
          label="需关注"
          value={state?.summary.attention_provider_count || 0}
          detail="provider issue"
        />
        <MetricCard
          label="Review run"
          value={state?.summary.review_run_count || 0}
          detail="人工复核任务"
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
                    <p className="text-xs text-[var(--muted)]">{provider.provider_kind}</p>
                  </td>
                  <td className="border-b border-[var(--border)] py-3 pr-4 font-mono text-xs">
                    {provider.protocol}
                  </td>
                  <td className="border-b border-[var(--border)] py-3 pr-4 font-mono text-xs">
                    {provider.default_model || "-"}
                  </td>
                  <td className="border-b border-[var(--border)] py-3 pr-4">
                    {provider.requires_api_key ? (
                      <StatusBadge
                        value={provider.api_key_configured ? "configured" : "missing"}
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
            {(state?.task_plugins || []).map((plugin) => (
              <div
                key={plugin.code}
                className="rounded-[8px] border border-[var(--border)] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{plugin.title}</p>
                    <p className="font-mono text-xs text-[var(--muted)]">
                      {plugin.code} / {plugin.task_type}
                    </p>
                  </div>
                  <StatusBadge value={plugin.runnable ? "active" : "disabled"} />
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {plugin.required_capabilities.join(", ") || "无能力要求"}
                </p>
              </div>
            ))}
            {!providersQuery.isLoading && !state?.task_plugins.length ? (
              <Message tone="info">暂无任务插件</Message>
            ) : null}
          </div>
        </Panel>

        <Panel title="最近运行">
          <div className="grid gap-2">
            {(state?.task_runs || []).slice(0, 12).map((run) => (
              <div key={run.id} className="rounded-[8px] border border-[var(--border)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{run.task_type}</p>
                    <p className="font-mono text-xs text-[var(--muted)]">{run.id}</p>
                  </div>
                  <StatusBadge value={run.status} />
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {run.provider_code || "-"} / {formatDate(run.created_at)}
                </p>
                {run.error_message ? (
                  <p className="mt-1 truncate text-xs text-[var(--danger)]">
                    {run.error_message}
                  </p>
                ) : null}
              </div>
            ))}
            {!providersQuery.isLoading && !state?.task_runs.length ? (
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
