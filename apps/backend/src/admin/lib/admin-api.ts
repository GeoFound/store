export async function adminApi<T>(
  path: string,
  options: {
    method?: "GET" | "POST"
    body?: Record<string, unknown>
  } = {}
): Promise<T> {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export function formatDate(value?: string | null) {
  if (!value) {
    return "-"
  }

  return new Date(value).toLocaleString()
}
