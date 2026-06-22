export class AdminApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = "AdminApiError"
  }
}

export async function adminApi<T>(
  path: string,
  options: {
    method?: string
    body?: unknown
    headers?: Record<string, string>
  } = {},
) {
  const response = await fetch(`/api/admin/${path.replace(/^\/admin\/|^\//, "")}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    throw new AdminApiError(await readApiError(response), response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

async function readApiError(response: Response) {
  const text = await response.text()

  if (!text) {
    return `Admin API request failed: ${response.status}`
  }

  try {
    const data = JSON.parse(text) as {
      message?: string
      error?: string
    }

    return data.message || data.error || text
  } catch {
    return text
  }
}
