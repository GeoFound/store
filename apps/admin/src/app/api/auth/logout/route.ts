import { NextResponse } from "next/server"
import { clearAdminAuthCookie } from "@/lib/admin-auth-cookie"
import { rejectUnsafeCrossOriginRequest } from "@/lib/bff-security"

export async function POST(request: Request) {
  const rejected = rejectUnsafeCrossOriginRequest(request)

  if (rejected) {
    return rejected
  }

  const response = NextResponse.json({ ok: true })

  clearAdminAuthCookie(response)

  return response
}
