import { cn } from "@/lib/utils"

const TONES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  configured: "bg-emerald-50 text-emerald-700",
  delivered: "bg-emerald-50 text-emerald-700",
  ok: "bg-emerald-50 text-emerald-700",
  resolved: "bg-emerald-50 text-emerald-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  pending: "bg-amber-50 text-amber-700",
  processing: "bg-sky-50 text-sky-700",
  running: "bg-sky-50 text-sky-700",
  failed: "bg-red-50 text-red-700",
  critical: "bg-red-50 text-red-700",
  disabled: "bg-slate-100 text-slate-600",
  dead: "bg-red-50 text-red-700",
}

export function StatusBadge({
  value,
  className,
}: {
  value?: string | null
  className?: string
}) {
  const normalized = String(value || "unknown").toLowerCase()

  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        TONES[normalized] || "bg-slate-100 text-slate-600",
        className,
      )}
    >
      {value || "unknown"}
    </span>
  )
}
