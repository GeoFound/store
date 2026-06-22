import { NextResponse } from "next/server"
import { getAdminAuthToken } from "@/lib/admin-auth-cookie"
import { retrieveAdminUser } from "@/lib/medusa-admin"

export async function GET() {
  const token = await getAdminAuthToken()

  if (!token) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 })
  }

  try {
    const user = await retrieveAdminUser(token)

    return NextResponse.json({ ok: true, user })
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Admin session is invalid.",
      },
      { status: 401 },
    )
  }
}
