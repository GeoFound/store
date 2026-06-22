import { getAdminAuthToken } from "@/lib/admin-auth-cookie"
import { createAdminPath, medusaAdminFetchRaw } from "@/lib/medusa-admin"

export const dynamic = "force-dynamic"

type Snapshot = {
  label: string
  path: string
  data: unknown
  ok: boolean
  status: number
  message?: string
}

const READ_ONLY_ENDPOINTS = [
  {
    label: "Ops",
    path: createAdminPath("ops-control/dashboard"),
  },
  {
    label: "Audit",
    path: createAdminPath("audit-logs", "limit=10"),
  },
  {
    label: "Events",
    path: createAdminPath("analytics/events", "limit=10"),
  },
  {
    label: "Dispatches",
    path: createAdminPath("analytics/dispatches", "limit=10"),
  },
  {
    label: "AI",
    path: createAdminPath("ai/providers"),
  },
]

export default async function DashboardPage() {
  const token = await getAdminAuthToken()
  const snapshots = await Promise.all(
    READ_ONLY_ENDPOINTS.map((endpoint) => readSnapshot(endpoint, token)),
  )
  const online = snapshots.filter((snapshot) => snapshot.ok).length
  const failed = snapshots.length - online

  return (
    <main className="px-5 py-5">
      <section className="mb-5 grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">运营看板</h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
            第一批迁移只读页面，用同源 BFF 验证 admin JWT、token refresh 和
            /admin/* 代理边界。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Metric label="API 可读" value={`${online}/${snapshots.length}`} />
          <Metric label="需处理" value={String(failed)} tone={failed ? "warn" : "ok"} />
        </div>
      </section>

      <section className="mb-5 grid gap-3 md:grid-cols-3">
        <Panel title="安全边界" value="SameSite + Origin" />
        <Panel title="Medusa 调用" value="Bearer / no Origin" />
        <Panel title="旧后台" value="/app 继续兜底" />
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        {snapshots.map((snapshot) => (
          <article
            key={snapshot.path}
            className="min-w-0 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">{snapshot.label}</h2>
                <p className="truncate font-mono text-xs text-[var(--muted)]">
                  {snapshot.path}
                </p>
              </div>
              <span
                className={
                  snapshot.ok
                    ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-[var(--success)]"
                    : "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-[var(--warning)]"
                }
              >
                {snapshot.ok ? "OK" : snapshot.status}
              </span>
            </div>
            <pre className="max-h-56 overflow-auto rounded-[8px] bg-[var(--surface-muted)] p-3 text-xs leading-5 text-[var(--foreground)]">
              {JSON.stringify(snapshot.ok ? snapshot.data : snapshot.message, null, 2)}
            </pre>
          </article>
        ))}
      </section>
    </main>
  )
}

async function readSnapshot(
  endpoint: {
    label: string
    path: string
  },
  token: string,
): Promise<Snapshot> {
  try {
    const response = await medusaAdminFetchRaw(endpoint.path, {
      method: "GET",
      token,
    })

    if (!response.ok) {
      return {
        label: endpoint.label,
        path: endpoint.path,
        data: null,
        ok: false,
        status: response.status,
        message: await response.text(),
      }
    }

    return {
      label: endpoint.label,
      path: endpoint.path,
      data: await response.json(),
      ok: true,
      status: response.status,
    }
  } catch (error) {
    return {
      label: endpoint.label,
      path: endpoint.path,
      data: null,
      ok: false,
      status: 0,
      message: error instanceof Error ? error.message : "Request failed.",
    }
  }
}

function Metric({
  label,
  value,
  tone = "ok",
}: {
  label: string
  value: string
  tone?: "ok" | "warn"
}) {
  return (
    <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
        {label}
      </p>
      <p
        className={
          tone === "ok"
            ? "mt-2 text-2xl font-semibold text-[var(--success)]"
            : "mt-2 text-2xl font-semibold text-[var(--warning)]"
        }
      >
        {value}
      </p>
    </div>
  )
}

function Panel({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
        {title}
      </p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  )
}
