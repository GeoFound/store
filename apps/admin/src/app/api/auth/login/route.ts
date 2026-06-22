import { NextResponse } from "next/server"
import { setAdminAuthCookie } from "@/lib/admin-auth-cookie"
import { rejectUnsafeCrossOriginRequest } from "@/lib/bff-security"
import { loginAdmin, retrieveAdminUser } from "@/lib/medusa-admin"

export async function POST(request: Request) {
  const rejected = rejectUnsafeCrossOriginRequest(request)

  if (rejected) {
    return rejected
  }

  try {
    const body = (await request.json()) as {
      email?: string
      password?: string
    }
    const email = String(body.email || "").trim().toLowerCase()
    const password = String(body.password || "")

    if (!email || !password) {
      return NextResponse.json(
        { message: "Email and password are required." },
        { status: 400 },
      )
    }

    const token = await loginAdmin({ email, password })
    const user = await retrieveAdminUser(token).catch(() => null)
    const response = NextResponse.json({ ok: true, user })

    setAdminAuthCookie(response, token)

    return response
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Admin login failed.",
      },
      { status: 401 },
    )
  }
}
