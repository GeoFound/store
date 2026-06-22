import type { ReactNode } from "react"

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <section className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </section>
  )
}

export function Panel({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
        ) : null}
      </div>
      <div className="min-w-0 p-4">{children}</div>
    </section>
  )
}

export function MetricCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string | number
  detail?: string
}) {
  return (
    <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 truncate text-2xl font-semibold">{value}</p>
      {detail ? (
        <p className="mt-2 truncate text-sm text-[var(--muted)]">{detail}</p>
      ) : null}
    </div>
  )
}

export function Message({
  tone,
  children,
}: {
  tone: "error" | "info"
  children: ReactNode
}) {
  return (
    <div
      className={
        tone === "error"
          ? "rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-[var(--danger)]"
          : "rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-[var(--muted)]"
      }
    >
      {children}
    </div>
  )
}

export function TableShell({
  children,
}: {
  children: ReactNode
}) {
  return <div className="overflow-x-auto">{children}</div>
}
