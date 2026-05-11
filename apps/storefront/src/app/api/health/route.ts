import { NextResponse } from "next/server"

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "storefront",
    timestamp: new Date().toISOString(),
  })
}
