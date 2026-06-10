import { NextResponse } from "next/server"
import {
  getCustomerAuthToken,
  retrieveCustomerAccount,
} from "@/lib/account-server"
import { isCustomerAccountEnabled } from "@/lib/customer-account-policy"

export async function GET() {
  if (!isCustomerAccountEnabled()) {
    return NextResponse.json(
      { message: "Customer accounts are not enabled." },
      { status: 404 }
    )
  }

  const token = await getCustomerAuthToken()

  if (!token) {
    return NextResponse.json(
      { message: "Customer authentication is required." },
      { status: 401 }
    )
  }

  try {
    const customer = await retrieveCustomerAccount(token)

    return NextResponse.json({ customer })
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Customer lookup failed.",
      },
      { status: 401 }
    )
  }
}
