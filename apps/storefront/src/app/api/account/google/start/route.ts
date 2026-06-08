import { NextResponse } from "next/server"
import { startGoogleCustomerLogin } from "@/lib/account-server"

export async function POST(request: Request) {
  try {
    const callbackUrl = new URL("/api/account/google/callback", request.url)
    const result = await startGoogleCustomerLogin(callbackUrl.toString())

    if (!result.location) {
      return NextResponse.json(
        { message: "Google login did not return a redirect URL." },
        { status: 503 }
      )
    }

    return NextResponse.json({ location: result.location })
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Google login is not available.",
      },
      { status: 503 }
    )
  }
}
