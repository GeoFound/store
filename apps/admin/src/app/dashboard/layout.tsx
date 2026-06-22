import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { AdminShell } from "@/components/admin-shell"
import { getAdminAuthToken } from "@/lib/admin-auth-cookie"

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const token = await getAdminAuthToken()

  if (!token) {
    redirect("/login")
  }

  return <AdminShell>{children}</AdminShell>
}
