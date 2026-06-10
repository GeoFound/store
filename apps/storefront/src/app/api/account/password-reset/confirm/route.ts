import { NextResponse } from "next/server"
import { confirmCustomerPasswordReset } from "@/lib/account-server"
import { isCustomerPasswordResetEnabled } from "@/lib/customer-account-policy"
import { checkAccountAuthRateLimit } from "@/lib/server-abuse-guard"

export async function POST(request: Request) {
  if (!isCustomerPasswordResetEnabled()) {
    return NextResponse.json(
      { message: "Customer password reset is not enabled." },
      { status: 404 }
    )
  }

  const rateLimitResponse = checkAccountAuthRateLimit(
    request,
    "account-password-reset-confirm"
  )

  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    const body = (await request.json()) as {
      token?: string
      password?: string
    }
    const token = String(body.token || "").trim()
    const password = String(body.password || "")

    if (!token) {
      return NextResponse.json(
        { message: "Reset token is required." },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { message: "Password must be at least 8 characters." },
        { status: 400 }
      )
    }

    await confirmCustomerPasswordReset({
      token,
      password,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Password reset failed.",
      },
      { status: 400 }
    )
  }
}
