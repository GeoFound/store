import { NextResponse } from "next/server"
import {
  clearAdminAuthCookie,
  getAdminAuthToken,
  setAdminAuthCookie,
} from "@/lib/admin-auth-cookie"
import { rejectUnsafeCrossOriginRequest } from "@/lib/bff-security"
import { refreshAdminToken } from "@/lib/medusa-admin"

export async function POST(request: Request) {
  const rejected = rejectUnsafeCrossOriginRequest(request)

  if (rejected) {
    return rejected
  }

  const token = await getAdminAuthToken()

  if (!token) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 })
  }

  try {
    const refreshedToken = await refreshAdminToken(token)
    const response = NextResponse.json({ ok: true })

    setAdminAuthCookie(response, refreshedToken)

    return response
  } catch (error) {
    const response = NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Admin session refresh failed.",
      },
      { status: 401 },
    )

    clearAdminAuthCookie(response)

    return response
  }
}
