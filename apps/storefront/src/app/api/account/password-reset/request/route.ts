import { NextResponse } from "next/server"
import { requestCustomerPasswordReset } from "@/lib/account-server"
import {
  isCustomerPasswordResetEnabled,
  resolveCustomerPasswordResetUrl,
} from "@/lib/customer-account-policy"
import {
  checkAccountAuthRateLimit,
  verifyAccountTurnstile,
} from "@/lib/server-abuse-guard"

export async function POST(request: Request) {
  if (!isCustomerPasswordResetEnabled()) {
    return NextResponse.json(
      { message: "Customer password reset is not enabled." },
      { status: 404 }
    )
  }

  const rateLimitResponse = checkAccountAuthRateLimit(
    request,
    "account-password-reset-request"
  )

  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    const body = (await request.json()) as {
      email?: string
      turnstile_token?: string
    }
    const email = String(body.email || "").trim().toLowerCase()

    if (!email) {
      return NextResponse.json(
        { message: "Email is required." },
        { status: 400 }
      )
    }

    const turnstileError = await verifyAccountTurnstile({
      request,
      token: body.turnstile_token,
    })

    if (turnstileError) {
      return NextResponse.json({ message: turnstileError }, { status: 403 })
    }

    await requestCustomerPasswordReset({
      email,
      resetUrl: resolveCustomerPasswordResetUrl({
        requestUrl: request.url,
      }),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Password reset request failed.",
      },
      { status: 400 }
    )
  }
}
