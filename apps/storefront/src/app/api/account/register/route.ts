import { NextResponse } from "next/server"
import {
  registerCustomerAccount,
  setCustomerAuthCookie,
} from "@/lib/account-server"
import {
  checkAccountAuthRateLimit,
  verifyAccountTurnstile,
} from "@/lib/server-abuse-guard"

export async function POST(request: Request) {
  const rateLimitResponse = checkAccountAuthRateLimit(request, "account-register")

  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    const body = (await request.json()) as {
      first_name?: string
      last_name?: string
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

    const token = await registerCustomerAccount({
      firstName: String(body.first_name || "").trim(),
      lastName: String(body.last_name || "").trim(),
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
          error instanceof Error ? error.message : "Customer registration failed.",
      },
      { status: 400 }
    )
  }
}
