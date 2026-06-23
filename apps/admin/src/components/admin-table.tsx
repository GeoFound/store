import type { ReactNode } from "react"
import { Message, TableShell } from "./admin-page"

export function AdminTable({
  headers,
  empty,
  children,
}: {
  headers: string[]
  empty: boolean
  children: ReactNode
}) {
  return (
    <>
      <TableShell>
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
              {headers.map((header) => (
                <th
                  key={header}
                  className="border-b border-[var(--border)] py-2 pr-4"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </TableShell>
      {empty ? <Message tone="info">暂无数据</Message> : null}
    </>
  )
}

export function Cell({
  children,
  mono,
  align = "left",
}: {
  children: ReactNode
  mono?: boolean
  align?: "left" | "right"
}) {
  return (
    <td
      className={[
        "border-b border-[var(--border)] py-3 pr-4",
        mono ? "font-mono text-xs" : "",
        align === "right" ? "text-right" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </td>
  )
}

export function normalizeError(error: unknown) {
  return error instanceof Error ? error.message : "请求失败。"
}
