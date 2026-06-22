export function isSafeMethod(method: string) {
  return ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())
}

export function resolveBrowserSuppliedOrigin(request: Request) {
  const origin = request.headers.get("origin")

  if (origin) {
    return normalizeOrigin(origin)
  }

  const referer = request.headers.get("referer")

  if (!referer) {
    return null
  }

  return normalizeOrigin(referer)
}

export function isSameOriginRequest(request: Request) {
  if (isSafeMethod(request.method)) {
    return true
  }

  const browserOrigin = resolveBrowserSuppliedOrigin(request)

  if (!browserOrigin) {
    return false
  }

  // request.url is unreliable behind a TLS-terminating reverse proxy (its scheme
  // or host can be the internal one), so an exact match is best-effort. Trusted
  // public origins are configured explicitly via ADMIN_TRUSTED_ORIGINS.
  const requestOrigin = normalizeOrigin(request.url)

  if (requestOrigin && browserOrigin === requestOrigin) {
    return true
  }

  return trustedOrigins().includes(browserOrigin)
}

function trustedOrigins() {
  return String(process.env.ADMIN_TRUSTED_ORIGINS || "")
    .split(",")
    .map((value) => normalizeOrigin(value.trim()))
    .filter((value): value is string => Boolean(value))
}

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}
