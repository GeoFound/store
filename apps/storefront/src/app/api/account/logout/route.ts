import { NextResponse } from "next/server"
import { clearCustomerAuthCookie } from "@/lib/account-server"

export async function POST() {
  const response = NextResponse.json({ ok: true })

  clearCustomerAuthCookie(response)

  return response
}
