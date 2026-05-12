import type { NextConfig } from "next"

type RemotePattern = NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
>[number]

const remotePatterns = resolveRemoteImagePatterns()

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns,
  },
}

export default nextConfig

function resolveRemoteImagePatterns() {
  const patterns: RemotePattern[] = [
    {
      protocol: "http",
      hostname: "localhost",
    },
  ]
  const seen = new Set<string>(["http://localhost"])

  const candidates = [
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "",
    process.env.NEXT_PUBLIC_ALLOWED_IMAGE_HOSTS || "",
  ]

  for (const candidate of candidates) {
    const entries = candidate
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)

    for (const entry of entries) {
      const parsed = parseImageHost(entry)

      if (!parsed) {
        continue
      }

      const key = `${parsed.protocol}://${parsed.hostname}:${parsed.port || ""}`

      if (seen.has(key)) {
        continue
      }

      seen.add(key)
      patterns.push(parsed)
    }
  }

  return patterns
}

function parseImageHost(value: string): RemotePattern | null {
  try {
    const asUrl =
      value.startsWith("http://") || value.startsWith("https://")
        ? new URL(value)
        : new URL(`https://${value}`)

    if (!["http:", "https:"].includes(asUrl.protocol) || !asUrl.hostname) {
      return null
    }

    return {
      protocol: asUrl.protocol.replace(":", "") as "http" | "https",
      hostname: asUrl.hostname,
      port: asUrl.port || undefined,
    }
  } catch {
    return null
  }
}
