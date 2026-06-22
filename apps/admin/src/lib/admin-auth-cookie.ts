import "server-only"

import { cookies } from "next/headers"
import type { NextResponse } from "next/server"

export const ADMIN_AUTH_COOKIE = "store_admin_auth_token"

const ADMIN_AUTH_COOKIE_MAX_AGE = 60 * 60 * 12

export async function getAdminAuthToken() {
  const cookieStore = await cookies()

  return cookieStore.get(ADMIN_AUTH_COOKIE)?.value || ""
}

export function setAdminAuthCookie(response: NextResponse, token: string) {
  response.cookies.set(ADMIN_AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_AUTH_COOKIE_MAX_AGE,
  })
}

export function clearAdminAuthCookie(response: NextResponse) {
  response.cookies.set(ADMIN_AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
}
