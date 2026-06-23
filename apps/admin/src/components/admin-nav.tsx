"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const NAV_GROUPS = [
  {
    title: "后台",
    links: [
      { label: "运营看板", href: "/dashboard" },
      { label: "商品", href: "/dashboard/products" },
      { label: "订单", href: "/dashboard/orders" },
      { label: "客户", href: "/dashboard/customers" },
      { label: "审计日志", href: "/dashboard/audit-logs" },
      { label: "分析事件", href: "/dashboard/analytics" },
      { label: "AI 状态", href: "/dashboard/ai" },
      { label: "运营控制", href: "/dashboard/ops" },
      { label: "营销", href: "/dashboard/marketing" },
      { label: "供应商", href: "/dashboard/suppliers" },
      { label: "支付", href: "/dashboard/payments" },
      { label: "凭证库存", href: "/dashboard/credentials" },
      { label: "数字交付", href: "/dashboard/deliveries" },
      { label: "SEO", href: "/dashboard/seo" },
      { label: "内容", href: "/dashboard/content" },
      { label: "商品发布", href: "/dashboard/product-publishing" },
      { label: "售后", href: "/dashboard/after-sales" },
      { label: "系统设置", href: "/dashboard/system" },
    ],
  },
]

function isActivePath(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href)
}

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="border-t border-[var(--border)] px-4 pb-4 pt-3 lg:grid lg:gap-5 lg:border-t-0 lg:px-5 lg:pt-0">
      {NAV_GROUPS.map((group) => (
        <section key={group.title} className="grid gap-2">
          <h2 className="sr-only px-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)] lg:not-sr-only">
            {group.title}
          </h2>
          <div className="-mx-1 flex gap-1 overflow-x-auto pb-1 lg:mx-0 lg:grid lg:overflow-visible lg:pb-0">
            {group.links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                aria-current={
                  isActivePath(pathname, link.href) ? "page" : undefined
                }
                className={
                  isActivePath(pathname, link.href)
                    ? "shrink-0 whitespace-nowrap rounded-[8px] bg-[var(--surface-muted)] px-2.5 py-2 text-sm font-semibold text-[var(--foreground)] lg:whitespace-normal"
                    : "shrink-0 whitespace-nowrap rounded-[8px] px-2.5 py-2 text-sm text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] lg:whitespace-normal"
                }
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </nav>
  )
}
