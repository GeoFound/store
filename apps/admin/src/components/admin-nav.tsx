"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const NAV_GROUPS = [
  {
    title: "已迁移",
    links: [
      { label: "运营看板", href: "/dashboard" },
      { label: "审计日志", href: "/dashboard/audit-logs" },
      { label: "分析事件", href: "/dashboard/analytics" },
      { label: "AI 状态", href: "/dashboard/ai" },
      { label: "运营控制", href: "/dashboard/ops" },
      { label: "营销", href: "/dashboard/marketing" },
      { label: "供应商", href: "/dashboard/suppliers" },
      { label: "支付", href: "/dashboard/payments" },
    ],
  },
  {
    title: "待迁移",
    links: [
      { label: "商品", href: null },
      { label: "内容", href: null },
      { label: "订单", href: null },
      { label: "凭证", href: null },
      { label: "售后", href: null },
      { label: "SEO", href: null },
      { label: "系统设置", href: null },
    ],
  },
]

function isActivePath(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href)
}

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="grid gap-5 px-4 pb-5 lg:px-5">
      {NAV_GROUPS.map((group) => (
        <section key={group.title} className="grid gap-2">
          <h2 className="px-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            {group.title}
          </h2>
          <div className="grid gap-1">
            {group.links.map((link) =>
              link.href ? (
                <Link
                  key={link.label}
                  href={link.href}
                  aria-current={
                    isActivePath(pathname, link.href) ? "page" : undefined
                  }
                  className={
                    isActivePath(pathname, link.href)
                      ? "rounded-[8px] bg-[var(--surface-muted)] px-2 py-2 text-sm font-semibold text-[var(--foreground)]"
                      : "rounded-[8px] px-2 py-2 text-sm text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                  }
                >
                  {link.label}
                </Link>
              ) : (
                <span
                  key={link.label}
                  className="rounded-[8px] px-2 py-2 text-sm text-[var(--muted)] opacity-70"
                >
                  {link.label}
                </span>
              ),
            )}
          </div>
        </section>
      ))}
    </nav>
  )
}
