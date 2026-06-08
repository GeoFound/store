import { NextResponse } from "next/server"
import {
  loginCustomerAccount,
  setCustomerAuthCookie,
} from "@/lib/account-server"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string
      password?: string
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
