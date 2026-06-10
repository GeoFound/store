import "server-only"

import { cookies } from "next/headers"
import type { NextResponse } from "next/server"

export {
  completeGoogleCustomerLoginWithMedusa as completeGoogleCustomerLogin,
  confirmCustomerPasswordResetWithMedusa as confirmCustomerPasswordReset,
  listCustomerAccountOrdersWithMedusa as listCustomerAccountOrders,
  loginCustomerAccountWithMedusa as loginCustomerAccount,
  registerCustomerAccountWithMedusa as registerCustomerAccount,
  requestCustomerPasswordResetWithMedusa as requestCustomerPasswordReset,
  retrieveCustomerAccountWithMedusa as retrieveCustomerAccount,
  startGoogleCustomerLoginWithMedusa as startGoogleCustomerLogin,
} from "./commerce-medusa"
export type { AccountOrder, CustomerAccount } from "./types"

export const CUSTOMER_AUTH_COOKIE = "store_customer_auth_token"

const CUSTOMER_AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

export async function getCustomerAuthToken() {
  const cookieStore = await cookies()

  return cookieStore.get(CUSTOMER_AUTH_COOKIE)?.value || ""
}

export function setCustomerAuthCookie(response: NextResponse, token: string) {
  response.cookies.set(CUSTOMER_AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CUSTOMER_AUTH_COOKIE_MAX_AGE,
  })
}

export function clearCustomerAuthCookie(response: NextResponse) {
  response.cookies.set(CUSTOMER_AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
}
