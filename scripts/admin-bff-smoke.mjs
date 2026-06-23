#!/usr/bin/env node

const adminAppUrl = normalizeUrl(
  process.env.ADMIN_APP_URL || "http://127.0.0.1:8001",
)
const email = process.env.ADMIN_SMOKE_EMAIL || ""
const password = process.env.ADMIN_SMOKE_PASSWORD || ""

if (!email || !password) {
  fail(
    "ADMIN_SMOKE_EMAIL and ADMIN_SMOKE_PASSWORD are required for authenticated admin BFF smoke.",
  )
}

const jar = new CookieJar()

await expectStatus("unauthenticated admin proxy is rejected", () =>
  request("/api/admin/custom"),
  401,
)

await expectStatus("cross-origin login mutation is rejected", () =>
  request("/api/auth/login", {
    method: "POST",
    origin: "https://attacker.invalid",
    json: { email, password },
  }),
  403,
)

await expectOk("admin login sets httpOnly session cookie", () =>
  request("/api/auth/login", {
    method: "POST",
    origin: adminAppUrl,
    json: { email, password },
  }),
)

if (!jar.has("store_admin_auth_token")) {
  fail("login did not set store_admin_auth_token cookie")
}

await expectOk("admin session returns current user", () => request("/api/auth/me"))
await expectOk("admin proxy reaches built-in /admin/users/me", () =>
  request("/api/admin/users/me"),
)
await expectOk("admin proxy reaches custom ops dashboard", () =>
  request("/api/admin/ops-control/dashboard"),
)
await expectOk("admin token refresh succeeds through BFF", () =>
  request("/api/auth/refresh", {
    method: "POST",
    origin: adminAppUrl,
  }),
)
await expectOk("admin logout clears session", () =>
  request("/api/auth/logout", {
    method: "POST",
    origin: adminAppUrl,
  }),
)

await expectStatus("admin proxy is rejected after logout", () =>
  request("/api/admin/users/me"),
  401,
)

console.log("admin BFF smoke passed")

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {})

  headers.set("Accept", "application/json")
  if (options.origin) {
    headers.set("Origin", options.origin)
  }
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json")
  }
  if (jar.header()) {
    headers.set("Cookie", jar.header())
  }

  const response = await fetch(new URL(path, adminAppUrl), {
    method: options.method || "GET",
    headers,
    body: options.json === undefined ? undefined : JSON.stringify(options.json),
    redirect: "manual",
  })

  jar.capture(response.headers)

  return response
}

async function expectOk(label, makeRequest) {
  const response = await makeRequest()

  if (!response.ok) {
    fail(`${label}: expected 2xx, got ${response.status}: ${await responseText(response)}`)
  }

  console.log(`ok - ${label}`)
}

async function expectStatus(label, makeRequest, status) {
  const response = await makeRequest()

  if (response.status !== status) {
    fail(
      `${label}: expected ${status}, got ${response.status}: ${await responseText(response)}`,
    )
  }

  console.log(`ok - ${label}`)
}

async function responseText(response) {
  const text = await response.text().catch(() => "")

  return text.slice(0, 500)
}

function normalizeUrl(value) {
  const url = new URL(value)

  return url.origin
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

class CookieJar {
  #cookies = new Map()

  capture(headers) {
    for (const cookie of getSetCookies(headers)) {
      const [pair] = cookie.split(";")
      const separator = pair.indexOf("=")

      if (separator === -1) {
        continue
      }

      const name = pair.slice(0, separator).trim()
      const value = pair.slice(separator + 1)

      if (!name) {
        continue
      }

      if (value === "") {
        this.#cookies.delete(name)
      } else {
        this.#cookies.set(name, value)
      }
    }
  }

  has(name) {
    return this.#cookies.has(name)
  }

  header() {
    return Array.from(this.#cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ")
  }
}

function getSetCookies(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie()
  }

  const value = headers.get("set-cookie")

  return value ? [value] : []
}
