export type G2aConfig = {
  baseUrl: string
  token: string
  configured: boolean
}

export function getG2aConfig(
  env: Record<string, string | undefined> = process.env
): G2aConfig {
  const token =
    env.G2A_ACCESS_TOKEN?.trim() ||
    env.G2A_API_TOKEN?.trim() ||
    env.G2A_API_KEY?.trim() ||
    ""

  return {
    baseUrl: trimTrailingSlash(
      env.G2A_API_BASE_URL?.trim() || "https://api.g2a.com"
    ),
    token,
    configured: Boolean(token),
  }
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "")
}
