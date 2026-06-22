"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export function LogoutButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function logout() {
    setPending(true)

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      })
    } finally {
      router.replace("/login")
      router.refresh()
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={logout}
      className="h-9 border border-[var(--border)] bg-white px-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
    >
      {pending ? "退出中" : "退出"}
    </button>
  )
}
