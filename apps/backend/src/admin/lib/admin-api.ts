export async function adminApi<T>(
  path: string,
  options: {
    method?: "GET" | "POST"
    body?: Record<string, unknown>
  } = {}
): Promise<T> {
  const locale = resolveAdminLocale()
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "Accept-Language": locale,
      "x-admin-locale": locale,
    },
    credentials: "include",
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    const message = await readErrorMessage(response)
    throw new Error(message || fallbackRequestError(response.status))
  }

  return response.json() as Promise<T>
}

export function formatDate(value?: string | null) {
  if (!value) {
    return "-"
  }

  return new Date(value).toLocaleString()
}

async function readErrorMessage(response: Response) {
  const text = await response.text()

  if (!text) {
    return ""
  }

  try {
    const payload = JSON.parse(text) as {
      message?: unknown
      error?: unknown
    }
    const message = payload.message || payload.error

    return typeof message === "string" ? message : text
  } catch {
    return text
  }
}

function resolveAdminLocale() {
  if (typeof window === "undefined") {
    return "en"
  }

  return (
    window.localStorage.getItem("i18nextLng") ||
    document.documentElement.lang ||
    window.navigator.language ||
    "en"
  )
}

function fallbackRequestError(status: number) {
  return resolveAdminLocale().toLowerCase().includes("zh")
    ? `请求失败：${status}`
    : `Request failed: ${status}`
}
