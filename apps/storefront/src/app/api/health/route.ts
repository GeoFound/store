import { NextResponse } from "next/server"

const DEFAULT_BACKEND_TIMEOUT_MS = 5000

export async function GET() {
  const backendBaseUrl = (process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "").trim()

  if (!backendBaseUrl) {
    return NextResponse.json(
      {
        ok: false,
        service: "storefront",
        timestamp: new Date().toISOString(),
        backend: {
          ok: false,
          error: "NEXT_PUBLIC_MEDUSA_BACKEND_URL is missing",
        },
      },
      {
        status: 503,
      }
    )
  }

  const backendUrl = `${backendBaseUrl.replace(/\/+$/, "")}/health`

  try {
    const response = await fetch(backendUrl, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(DEFAULT_BACKEND_TIMEOUT_MS),
    })
    const backendPayload = await response.json().catch(() => null)
    const backendOk = response.ok && backendPayload?.ok === true

    return NextResponse.json(
      {
        ok: backendOk,
        service: "storefront",
        timestamp: new Date().toISOString(),
        backend: {
          ok: backendOk,
          status: response.status,
        },
      },
      {
        status: backendOk ? 200 : 503,
      }
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        service: "storefront",
        timestamp: new Date().toISOString(),
        backend: {
          ok: false,
          error:
            error instanceof Error ? error.message : "backend health probe failed",
        },
      },
      {
        status: 503,
      }
    )
  }
}
