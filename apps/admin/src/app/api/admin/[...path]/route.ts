import { NextResponse } from "next/server"
import {
  clearAdminAuthCookie,
  getAdminAuthToken,
  setAdminAuthCookie,
} from "@/lib/admin-auth-cookie"
import { rejectUnsafeCrossOriginRequest } from "@/lib/bff-security"
import {
  createAdminPath,
  medusaAdminFetchRaw,
  refreshAdminToken,
} from "@/lib/medusa-admin"
import { isSafeMethod } from "@/lib/origin"

type RouteContext = {
  params: Promise<{
    path?: string[]
  }>
}

const BODY_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

export async function GET(request: Request, context: RouteContext) {
  return proxyAdminRequest(request, context)
}

export async function POST(request: Request, context: RouteContext) {
  return proxyAdminRequest(request, context)
}

export async function PUT(request: Request, context: RouteContext) {
  return proxyAdminRequest(request, context)
}

export async function PATCH(request: Request, context: RouteContext) {
  return proxyAdminRequest(request, context)
}

export async function DELETE(request: Request, context: RouteContext) {
  return proxyAdminRequest(request, context)
}

export async function OPTIONS() {
  return NextResponse.json({ ok: true })
}

async function proxyAdminRequest(request: Request, context: RouteContext) {
  if (!isSafeMethod(request.method)) {
    const rejected = rejectUnsafeCrossOriginRequest(request)

    if (rejected) {
      return rejected
    }
  }

  const token = await getAdminAuthToken()

  if (!token) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 })
  }

  const { path = [] } = await context.params
  const requestUrl = new URL(request.url)
  const adminPath = createAdminPath(path.join("/"), requestUrl.search)
  const body = await readReusableBody(request)
  const contentType = request.headers.get("content-type")
  const acceptLanguage = request.headers.get("accept-language")

  let currentToken = token
  let medusaResponse = await sendToMedusa({
    request,
    adminPath,
    token: currentToken,
    body,
    contentType,
    acceptLanguage,
  })
  let refreshedToken = ""

  if (medusaResponse.status === 401) {
    try {
      refreshedToken = await refreshAdminToken(currentToken)
      currentToken = refreshedToken
      medusaResponse = await sendToMedusa({
        request,
        adminPath,
        token: currentToken,
        body,
        contentType,
        acceptLanguage,
      })
    } catch {
      const response = NextResponse.json(
        { message: "Admin session expired." },
        { status: 401 },
      )

      clearAdminAuthCookie(response)

      return response
    }
  }

  const response = toNextResponse(medusaResponse)

  // Persist the refreshed token whenever it authenticated (any non-401 result),
  // not only on 2xx — otherwise a business error (e.g. 400/403) after a
  // successful refresh would drop the new token and force a refresh next request.
  if (refreshedToken && medusaResponse.status !== 401) {
    setAdminAuthCookie(response, refreshedToken)
  }

  return response
}

async function sendToMedusa(input: {
  request: Request
  adminPath: string
  token: string
  body: BodyInit | null
  contentType: string | null
  acceptLanguage: string | null
}) {
  return medusaAdminFetchRaw(input.adminPath, {
    method: input.request.method,
    token: input.token,
    body: input.body,
    contentType: input.contentType,
    acceptLanguage: input.acceptLanguage,
  })
}

async function readReusableBody(request: Request) {
  if (!BODY_METHODS.has(request.method.toUpperCase())) {
    return null
  }

  const body = await request.arrayBuffer()

  return body.byteLength > 0 ? body : null
}

function toNextResponse(response: Response) {
  return new NextResponse(response.status === 204 ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: copySafeResponseHeaders(response.headers),
  })
}

function copySafeResponseHeaders(source: Headers) {
  const headers = new Headers()

  for (const [key, value] of source.entries()) {
    const normalized = key.toLowerCase()

    if (
      normalized === "content-type" ||
      normalized === "cache-control" ||
      normalized === "etag" ||
      normalized === "last-modified"
    ) {
      headers.set(key, value)
    }
  }

  return headers
}
