import { NextResponse } from "next/server"
import { isSameOriginRequest } from "./origin"

export function rejectUnsafeCrossOriginRequest(request: Request) {
  if (isSameOriginRequest(request)) {
    return null
  }

  return NextResponse.json(
    { message: "Cross-origin admin mutation rejected." },
    { status: 403 },
  )
}
