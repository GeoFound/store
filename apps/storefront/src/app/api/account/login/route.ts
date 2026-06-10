import { NextResponse } from "next/server"
import {
  loginCustomerAccount,
  setCustomerAuthCookie,
} from "@/lib/account-server"
import { isCustomerAccountEnabled } from "@/lib/customer-account-policy"
import {
  checkAccountAuthRateLimit,
  verifyAccountTurnstile,
} from "@/lib/server-abuse-guard"

export async function POST(request: Request) {
  if (!isCustomerAccountEnabled()) {
    return NextResponse.json(
      { message: "Customer accounts are not enabled." },
      { status: 404 }
    )
  }

  const rateLimitResponse = checkAccountAuthRateLimit(request, "account-login")

  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    const body = (await request.json()) as {
      email?: string
      password?: string
      turnstile_token?: string
    }
    const turnstileError = await verifyAccountTurnstile({
      request,
      token: body.turnstile_token,
    })

    if (turnstileError) {
      return NextResponse.json({ message: turnstileError }, { status: 403 })
    }

    const token = await loginCustomerAccount({
      email: String(body.email || "").trim().toLowerCase(),
      password: String(body.password || ""),
    })
    const response = NextResponse.json({ ok: true })

    setCustomerAuthCookie(response, token)

    return response
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Customer login failed.",
      },
      { status: 401 }
    )
  }
}
