import { NextResponse } from "next/server"
import {
  completeGoogleCustomerLogin,
  setCustomerAuthCookie,
} from "@/lib/account-server"
import { isCustomerAccountEnabled } from "@/lib/customer-account-policy"

export async function GET(request: Request) {
  if (!isCustomerAccountEnabled()) {
    return NextResponse.redirect(new URL("/orders", request.url))
  }

  const url = new URL(request.url)

  try {
    const token = await completeGoogleCustomerLogin({
      query: url.searchParams,
    })
    const response = NextResponse.redirect(new URL("/account", request.url))

    setCustomerAuthCookie(response, token)

    return response
  } catch (error) {
    const next = new URL("/account/login", request.url)
    next.searchParams.set(
      "error",
      error instanceof Error ? error.message : "Google login failed."
    )

    return NextResponse.redirect(next)
  }
}
