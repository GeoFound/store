const PLACEHOLDER_PREFIX = "replace-with-"
const INSECURE_SECRET_VALUES = new Set(["supersecret"])

type ResolveSecretOptions = {
  testFallback?: string
  env?: Record<string, string | undefined>
}

type ResolveEncryptionKeyOptions = {
  fallbackName?: string
  testFallback?: string
  env?: Record<string, string | undefined>
}

type ResolveEncryptionKeyRingOptions = ResolveEncryptionKeyOptions & {
  previousNames?: string[]
}

export function resolveSecuritySecret(
  name: string,
  options: ResolveSecretOptions = {}
) {
  const env = options.env || process.env
  const value = env[name]?.trim()

  if (value && !isUnsafeSecretValue(value)) {
    return value
  }

  if (env.NODE_ENV === "test" && options.testFallback) {
    return options.testFallback
  }

  throw new Error(
    `${name} must be configured with a strong secret and cannot use defaults`
  )
}

export function resolveEncryptionKey(
  primaryName: string,
  options: ResolveEncryptionKeyOptions = {}
) {
  const env = options.env || process.env
  const primaryValue = env[primaryName]?.trim() || ""
  const fallbackValue = options.fallbackName
    ? env[options.fallbackName]?.trim() || ""
    : ""
  const candidate = primaryValue || fallbackValue

  if (candidate) {
    assertNotPlaceholder(candidate, primaryName)
    decodeEncryptionKey(candidate, primaryName)
    return candidate
  }

  if (env.NODE_ENV === "test" && options.testFallback) {
    decodeEncryptionKey(options.testFallback, primaryName)
    return options.testFallback
  }

  if (options.fallbackName) {
    throw new Error(
      `${primaryName} or ${options.fallbackName} must be configured and decode to 32 bytes`
    )
  }

  throw new Error(
    `${primaryName} must be configured and decode to 32 bytes`
  )
}

export function resolveEncryptionKeyRing(
  primaryName: string,
  options: ResolveEncryptionKeyRingOptions = {}
) {
  const env = options.env || process.env
  const previousNames = options.previousNames || []
  const resolvedPrimary = resolveEncryptionKey(primaryName, {
    ...options,
    env,
  })
  const candidates = [resolvedPrimary]

  for (const previousName of previousNames) {
    const rawValue = env[previousName]?.trim() || ""

    if (!rawValue) {
      continue
    }

    const parsedValues = rawValue
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean)

    if (!parsedValues.length) {
      throw new Error(
        `${previousName} must include at least one valid encryption key when set`
      )
    }

    for (const parsedValue of parsedValues) {
      assertNotPlaceholder(parsedValue, previousName)
      decodeEncryptionKey(parsedValue, previousName)
      candidates.push(parsedValue)
    }
  }

  const uniqueCandidates: string[] = []
  const seen = new Set<string>()
  for (const candidate of candidates) {
    if (seen.has(candidate)) {
      continue
    }
    seen.add(candidate)
    uniqueCandidates.push(candidate)
  }

  return uniqueCandidates
}

export function decodeEncryptionKey(value: string, name: string) {
  const key = /^[0-9a-f]{64}$/i.test(value)
    ? Buffer.from(value, "hex")
    : Buffer.from(value, "base64")

  if (key.length !== 32) {
    throw new Error(`${name} must decode to 32 bytes`)
  }

  return key
}

function isUnsafeSecretValue(value: string) {
  return (
    INSECURE_SECRET_VALUES.has(value.trim().toLowerCase()) ||
    value.trim().toLowerCase().startsWith(PLACEHOLDER_PREFIX)
  )
}

function assertNotPlaceholder(value: string, name: string) {
  if (value.trim().toLowerCase().startsWith(PLACEHOLDER_PREFIX)) {
    throw new Error(`${name} cannot use placeholder values`)
  }
}
