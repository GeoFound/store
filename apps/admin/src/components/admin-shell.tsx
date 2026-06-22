import type { ReactNode } from "react"
import { AdminNav } from "./admin-nav"
import { LogoutButton } from "./logout-button"

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-[var(--background)] lg:grid-cols-[16rem_1fr]">
      <aside className="border-b border-[var(--border)] bg-[var(--surface)] lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center justify-between px-5 lg:h-auto lg:items-start lg:px-5 lg:py-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              Store
            </p>
            <p className="mt-1 text-lg font-semibold">Admin</p>
          </div>
        </div>
        <AdminNav />
      </aside>

      <div className="min-w-0">
        <header className="flex min-h-16 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold">独立控制台</p>
            <p className="text-xs text-[var(--muted)]">
              BFF -&gt; Medusa /admin/*，浏览器不直连后端
            </p>
          </div>
          <LogoutButton />
        </header>
        {children}
      </div>
    </div>
  )
}
