"use client"

import { useState } from "react"
import { logoutCustomerAccount } from "@/lib/commerce"

export function AccountLogoutButton() {
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)

    try {
      await logoutCustomerAccount()
    } finally {
      window.location.href = "/"
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="theme-secondary-action min-h-11 px-4 text-sm font-semibold disabled:opacity-50"
    >
      {loading ? "Signing out..." : "Sign out"}
    </button>
  )
}
