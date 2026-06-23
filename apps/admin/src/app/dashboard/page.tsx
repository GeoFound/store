import Link from "next/link"
import { getAdminAuthToken } from "@/lib/admin-auth-cookie"
import { createAdminPath, medusaAdminFetchRaw } from "@/lib/medusa-admin"

export const dynamic = "force-dynamic"

type OverviewConfig = {
  label: string
  path: string
  href: string
  detail: string
  countKey?: string
}

// Operational overview that supersedes the legacy monolithic control-panel:
// a lean at-a-glance roll-up across the migrated surfaces, each linking to its
// dedicated page. All reads go through the same-origin BFF (Bearer server-side).
const OVERVIEW: OverviewConfig[] = [
  {
    label: "运营控制",
    path: createAdminPath("ops-control/dashboard"),
    href: "/dashboard/ops",
    detail: "ops dashboard",
  },
  {
    label: "支付渠道",
    path: createAdminPath("payment-channels"),
    href: "/dashboard/payments",
    detail: "channels",
    countKey: "channels",
  },
  {
    label: "支付尝试",
    path: createAdminPath("payment-attempts", "limit=25"),
    href: "/dashboard/payments",
    detail: "recent attempts",
    countKey: "attempts",
  },
  {
    label: "凭证批次",
    path: createAdminPath("credential-inventory/batches"),
    href: "/dashboard/credentials",
    detail: "batches",
    countKey: "batches",
  },
  {
    label: "待交付",
    path: createAdminPath("digital-delivery/pending", "limit=25"),
    href: "/dashboard/deliveries",
    detail: "pending items",
    countKey: "items",
  },
  {
    label: "供应商采购",
    path: createAdminPath("suppliers/procurements", "limit=25"),
    href: "/dashboard/suppliers",
    detail: "recent procurements",
    countKey: "procurements",
  },
  {
    label: "售后",
    path: createAdminPath("after-sales"),
    href: "/dashboard/after-sales",
    detail: "requests",
    countKey: "after_sales",
  },
  {
    label: "营销活动",
    path: createAdminPath("marketing/campaigns", "limit=25"),
    href: "/dashboard/marketing",
    detail: "campaigns",
    countKey: "campaigns",
  },
  {
    label: "内容条目",
    path: createAdminPath("content/entries", "limit=25"),
    href: "/dashboard/content",
    detail: "entries",
    countKey: "entries",
  },
  {
    label: "分析事件",
    path: createAdminPath("analytics/events", "limit=25"),
    href: "/dashboard/analytics",
    detail: "events",
    countKey: "events",
  },
  {
    label: "审计日志",
    path: createAdminPath("audit-logs", "limit=25"),
    href: "/dashboard/audit-logs",
    detail: "recent logs",
    countKey: "audit_logs",
  },
  {
    label: "AI 提供方",
    path: createAdminPath("ai/providers"),
    href: "/dashboard/ai",
    detail: "providers",
    countKey: "providers",
  },
]

type Tile = OverviewConfig & {
  ok: boolean
  status: number
  count: number | null
}

export default async function DashboardPage() {
  const token = await getAdminAuthToken()
  const tiles = await Promise.all(
    OVERVIEW.map((config) => readTile(config, token)),
  )
  const online = tiles.filter((tile) => tile.ok).length
  const failed = tiles.length - online

  return (
    <main className="px-5 py-5">
      <section className="mb-5 grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">运营看板</h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
            跨各运营面的只读总览，取代旧的单体控制台。每张卡片链接到对应专页；
            全部读取经由同源 BFF（服务端 Bearer，浏览器不接触 token）。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Metric label="接口健康" value={`${online}/${tiles.length}`} />
          <Metric
            label="需处理"
            value={String(failed)}
            tone={failed ? "warn" : "ok"}
          />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            key={`${tile.label}-${tile.path}`}
            href={tile.href}
            className="group min-w-0 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm transition-colors hover:border-[var(--accent)]"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold">{tile.label}</p>
              <span
                className={
                  tile.ok
                    ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-[var(--success)]"
                    : "rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-[var(--warning)]"
                }
              >
                {tile.ok ? "OK" : tile.status || "ERR"}
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold">
              {tile.ok ? (tile.count ?? "—") : "—"}
            </p>
            <p className="mt-1 truncate text-xs text-[var(--muted)]">
              {tile.detail}
            </p>
          </Link>
        ))}
      </section>

      <section className="mt-5 grid gap-3 md:grid-cols-3">
        <Panel title="安全边界" value="SameSite + Origin allowlist" />
        <Panel title="Medusa 调用" value="Bearer / 不转发 Origin" />
        <Panel title="旧后台" value="/app 迁移期兜底" />
      </section>
    </main>
  )
}

async function readTile(config: OverviewConfig, token: string): Promise<Tile> {
  try {
    const response = await medusaAdminFetchRaw(config.path, {
      method: "GET",
      token,
    })

    if (!response.ok) {
      return { ...config, ok: false, status: response.status, count: null }
    }

    const data = (await response.json()) as Record<string, unknown>

    return {
      ...config,
      ok: true,
      status: response.status,
      count: extractCount(data, config.countKey),
    }
  } catch {
    return { ...config, ok: false, status: 0, count: null }
  }
}

function extractCount(data: Record<string, unknown>, countKey?: string) {
  if (!countKey) {
    return null
  }

  const value = data[countKey]

  return Array.isArray(value) ? value.length : null
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
