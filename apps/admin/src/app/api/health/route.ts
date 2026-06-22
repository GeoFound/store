import { NextResponse } from "next/server"
import { medusaBackendUrl } from "@/lib/config"

export async function GET() {
  const startedAt = Date.now()

  try {
    const response = await fetch(`${medusaBackendUrl}/health`, {
      cache: "no-store",
    })

    return NextResponse.json({
      ok: response.ok,
      backend_status: response.status,
      latency_ms: Date.now() - startedAt,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Backend health check failed.",
      },
      { status: 503 },
    )
  }
}
