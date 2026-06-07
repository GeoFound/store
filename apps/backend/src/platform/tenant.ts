export const TENANT_DEPLOYMENT_MODES = [
  "dedicated",
  "pooled",
  "sharded",
] as const

export type TenantDeploymentMode = (typeof TENANT_DEPLOYMENT_MODES)[number]

export type TenantRuntimeOptions = {
  siteId: string
  siteEnv: string
  deploymentMode: TenantDeploymentMode
  allowedHosts: string[]
  failOnHostMismatch: boolean
  sharedDataPlaneReady: boolean
}

export type TenantResolutionInput = {
  host?: string | null
  siteIdHeader?: string | null
}

export type TenantContext = {
  siteId: string
  siteEnv: string
  deploymentMode: TenantDeploymentMode
  resolvedBy: "host" | "site-header" | "env"
  host?: string
}

export function parseTenantRuntimeOptionsFromEnv(
  env: Record<string, string | undefined> = process.env
): TenantRuntimeOptions {
  const siteId = normalizeSiteId(env.SITE_ID)

  if (!siteId) {
    throw new Error("SITE_ID is required for backend tenant context")
  }

  if (!normalizeString(env.SITE_ENV)) {
    throw new Error("SITE_ENV is required for backend tenant context")
  }

  const siteEnv = normalizeSiteEnv(env.SITE_ENV)

  const deploymentMode = parseTenantDeploymentMode(env.TENANCY_MODE)
  const sharedDataPlaneReady = parseBooleanFlag(
    env.TENANT_SHARED_DATA_PLANE_READY,
    false
  )

  if (deploymentMode !== "dedicated" && !sharedDataPlaneReady) {
    throw new Error(
      `TENANCY_MODE=${deploymentMode} requires TENANT_SHARED_DATA_PLANE_READY=true after tenant-scoped persistence, jobs, locks, and access-control checks exist.`
    )
  }

  return {
    siteId,
    siteEnv,
    deploymentMode,
    allowedHosts: parseHostList(env.TENANT_ALLOWED_HOSTS),
    failOnHostMismatch: parseBooleanFlag(env.TENANT_FAIL_ON_HOST_MISMATCH, true),
    sharedDataPlaneReady,
  }
}

export function resolveTenantContext(
  input: TenantResolutionInput,
  options: TenantRuntimeOptions
): TenantContext {
  const host = normalizeHost(input.host)
  const siteIdHeader = normalizeSiteId(input.siteIdHeader)

  if (siteIdHeader && siteIdHeader !== options.siteId) {
    throw new Error(
      `Tenant site header mismatch: expected ${options.siteId}, got ${siteIdHeader}`
    )
  }

  if (host && options.allowedHosts.length) {
    const allowed = options.allowedHosts.includes(host)

    if (!allowed && options.failOnHostMismatch) {
      throw new Error(
        `Tenant host mismatch: host ${host} is not allowed for SITE_ID=${options.siteId}`
      )
    }

    if (allowed) {
      return {
        siteId: options.siteId,
        siteEnv: options.siteEnv,
        deploymentMode: options.deploymentMode,
        resolvedBy: "host",
        host,
      }
    }
  }

  if (siteIdHeader) {
    return {
      siteId: options.siteId,
      siteEnv: options.siteEnv,
      deploymentMode: options.deploymentMode,
      resolvedBy: "site-header",
      ...(host ? { host } : {}),
    }
  }

  return {
    siteId: options.siteId,
    siteEnv: options.siteEnv,
    deploymentMode: options.deploymentMode,
    resolvedBy: "env",
    ...(host ? { host } : {}),
  }
}

export function parseTenantDeploymentMode(
  value?: string
): TenantDeploymentMode {
  const normalized = normalizeString(value).toLowerCase()

  if (!normalized) {
    return "dedicated"
  }

  if (isTenantDeploymentMode(normalized)) {
    return normalized
  }

  throw new Error(
    `Unsupported TENANCY_MODE "${normalized}". Supported values: ${TENANT_DEPLOYMENT_MODES.join(", ")}.`
  )
}

export function parseHostList(value?: string) {
  return Array.from(
    new Set(
      (value || "")
        .split(",")
        .map((entry) => normalizeHost(entry))
        .filter(Boolean)
    )
  )
}

export function normalizeSiteId(value: unknown) {
  const normalized = normalizeString(value)

  if (!normalized) {
    return ""
  }

  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(normalized)) {
    throw new Error(
      `Invalid site id "${normalized}". Use lowercase letters, numbers, and dashes.`
    )
  }

  return normalized
}

export function normalizeSiteEnv(value: unknown) {
  const normalized = normalizeString(value) || "development"

  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(normalized)) {
    throw new Error(
      `Invalid site env "${normalized}". Use lowercase letters, numbers, and dashes.`
    )
  }

  return normalized
}

export function normalizeHost(value: unknown) {
  const raw = normalizeString(value).toLowerCase()

  if (!raw) {
    return ""
  }

  const firstHost = raw.split(",")[0]?.trim() || ""
  const withoutProtocol = firstHost.replace(/^https?:\/\//, "")
  const withoutPath = withoutProtocol.split("/")[0] || ""
  const withoutPort = withoutPath.replace(/:\d+$/, "")

  return withoutPort.replace(/\.$/, "")
}

function isTenantDeploymentMode(value: string): value is TenantDeploymentMode {
  return TENANT_DEPLOYMENT_MODES.includes(value as TenantDeploymentMode)
}

function parseBooleanFlag(value: string | undefined, fallback: boolean) {
  const normalized = normalizeString(value).toLowerCase()

  if (!normalized) {
    return fallback
  }

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false
  }

  return fallback
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}
