import "server-only"

import { adminLocale, medusaBackendUrl } from "./config"

type AdminLoginInput = {
  email: string
  password: string
}

type TokenResponse = {
  token: string
}

export type AdminFetchOptions = {
  method?: string
  token: string
  body?: BodyInit | null
  contentType?: string | null
  acceptLanguage?: string | null
  cache?: RequestCache
}

export async function loginAdmin(input: AdminLoginInput) {
  const data = await medusaJsonFetch<TokenResponse>("/auth/user/emailpass", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      password: input.password,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  })

  return data.token
}

export async function refreshAdminToken(token: string) {
  const data = await medusaJsonFetch<TokenResponse>("/auth/token/refresh", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  return data.token
}

export async function retrieveAdminUser(token: string) {
  return medusaJsonFetch<unknown>("/admin/users/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-admin-locale": adminLocale,
    },
  })
}

export function createAdminPath(path: string, search = "") {
  const normalizedPath = path.replace(/^\/+/, "")
  const suffix = search.startsWith("?") ? search : search ? `?${search}` : ""

  return `/admin/${normalizedPath}${suffix}`
}

export async function medusaAdminFetchRaw(
  path: string,
  options: AdminFetchOptions,
) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${options.token}`,
    "x-admin-locale": adminLocale,
  }

  if (options.acceptLanguage) {
    headers["Accept-Language"] = options.acceptLanguage
  }

  if (options.contentType) {
    headers["Content-Type"] = options.contentType
  }

  return fetch(`${medusaBackendUrl}${path}`, {
    method: options.method || "GET",
    cache: options.cache || "no-store",
    headers,
    body: options.body || undefined,
  })
}

async function medusaJsonFetch<T>(
  path: string,
  init: {
    method: string
    headers?: Record<string, string>
    body?: BodyInit
  },
): Promise<T> {
  const response = await fetch(`${medusaBackendUrl}${path}`, {
    method: init.method,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...init.headers,
    },
    body: init.body,
  })

  if (!response.ok) {
    throw new Error(
      await readResponseError(response, `Medusa admin request failed: ${response.status}`),
    )
  }

  return response.json() as Promise<T>
}

export async function readResponseError(response: Response, fallback: string) {
  const text = await response.text()

  if (!text) {
    return fallback
  }

  try {
    const data = JSON.parse(text) as {
      message?: string
      error?: string
      type?: string
    }

    return data.message || data.error || text
  } catch {
    return text
  }
}
