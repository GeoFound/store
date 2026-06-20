import type { ContentAssetType, ContentStorageProviderKind } from "./types"
import crypto from "node:crypto"
import {
  ENV_NAME_PATTERN,
  hasInlineSecret,
  isRecord,
  normalizeBaseUrl,
  normalizeCode,
  readBoolean,
  readRecord,
  readStringArray,
  readText,
  sanitizeMetadata,
  text,
} from "../../utils/provider-config"

const STORAGE_INLINE_SECRET_ALLOWLIST = [
  "access_key_id_env",
  "accessKeyIdEnv",
  "access_key_env",
  "secret_access_key_env",
  "secretAccessKeyEnv",
  "secret_key_env",
  "session_token_env",
  "sessionTokenEnv",
]

export type ContentStorageProviderStatus =
  | "configured"
  | "disabled"
  | "invalid"
  | "missing_secret"
  | "missing_bucket"

export type ContentStorageProviderConfigSafe = {
  code: string
  label: string
  kind: ContentStorageProviderKind
  enabled: boolean
  bucket: string | null
  region: string | null
  endpoint: string | null
  public_base_url: string | null
  access_key_id_env: string | null
  access_key_id_configured: boolean
  secret_access_key_env: string | null
  secret_access_key_configured: boolean
  session_token_env: string | null
  session_token_configured: boolean
  force_path_style: boolean
  site_ids: string[]
  upload_strategy: "record_only" | "direct" | "backend_proxy" | "external"
  status: ContentStorageProviderStatus
  issues: string[]
  metadata: Record<string, unknown> | null
}

export type ContentStorageRuntimeConfig = {
  default_provider_code: string
  providers: ContentStorageProviderConfigSafe[]
  issues: string[]
}

export type ContentUploadPolicy = {
  provider_code: string
  storage_provider: ContentStorageProviderKind
  method: "PUT"
  upload_url: string
  public_url: string | null
  bucket: string | null
  object_key: string
  expires_at: string
  headers: Record<string, string>
}

const DEFAULT_PROVIDER_CODE = "local"

export function getContentStorageRuntimeConfig(
  env: Record<string, string | undefined> = process.env
): ContentStorageRuntimeConfig {
  const issues: string[] = []
  const providers = parseProviderConfigs(env, issues)
  const configuredDefault = text(env.CONTENT_STORAGE_DEFAULT_PROVIDER)
  const defaultProvider =
    providers.find((provider) => provider.code === configuredDefault) ||
    providers.find((provider) => provider.enabled && provider.status === "configured") ||
    providers.find((provider) => provider.enabled) ||
    providers[0]

  return {
    default_provider_code: configuredDefault || defaultProvider?.code || DEFAULT_PROVIDER_CODE,
    providers,
    issues,
  }
}

export function buildContentObjectKey(input: {
  assetType?: ContentAssetType
  entryId?: string | null
  filename?: string | null
  siteId?: string | null
}) {
  const siteId = normalizePathSegment(input.siteId || "global")
  const assetType = normalizePathSegment(input.assetType || "attachment")
  const entryId = normalizePathSegment(input.entryId || "unassigned")
  const filename = normalizeFilename(input.filename || "asset.bin")
  const random = crypto.randomBytes(6).toString("hex")

  return `${siteId}/content/${entryId}/${assetType}/${Date.now()}-${random}-${filename}`
}

export function createContentUploadPolicy(input: {
  providerCode?: string | null
  assetType?: ContentAssetType
  entryId?: string | null
  filename?: string | null
  mimeType?: string | null
  siteId?: string | null
  expiresInSeconds?: number | null
  env?: Record<string, string | undefined>
}): ContentUploadPolicy {
  const env = input.env || process.env
  const config = getContentStorageRuntimeConfig(env)
  const provider =
    (input.providerCode
      ? config.providers.find((item) => item.code === input.providerCode)
      : null) ||
    config.providers.find((item) => item.code === config.default_provider_code) ||
    config.providers[0]

  if (!provider) {
    throw new Error("No content storage provider is configured")
  }

  const objectKey = buildContentObjectKey({
    assetType: input.assetType,
    entryId: input.entryId,
    filename: input.filename || input.mimeType || "asset.bin",
    siteId: input.siteId,
  })
  const expiresInSeconds = Math.min(
    Math.max(Math.floor(Number(input.expiresInSeconds || 900)), 60),
    3600
  )
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()

  if (provider.kind !== "s3" && provider.kind !== "r2") {
    return {
      provider_code: provider.code,
      storage_provider: provider.kind,
      method: "PUT",
      upload_url: provider.public_base_url
        ? `${provider.public_base_url.replace(/\/+$/, "")}/${encodeObjectPath(objectKey)}`
        : "",
      public_url: provider.public_base_url
        ? `${provider.public_base_url.replace(/\/+$/, "")}/${encodeObjectPath(objectKey)}`
        : null,
      bucket: provider.bucket,
      object_key: objectKey,
      expires_at: expiresAt,
      headers: input.mimeType ? { "content-type": input.mimeType } : {},
    }
  }

  const accessKeyId = provider.access_key_id_env
    ? text(env[provider.access_key_id_env])
    : ""
  const secretAccessKey = provider.secret_access_key_env
    ? text(env[provider.secret_access_key_env])
    : ""
  const sessionToken = provider.session_token_env
    ? text(env[provider.session_token_env])
    : ""

  if (!provider.bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("S3/R2 content storage provider is missing bucket or credentials")
  }

  const signed = presignS3PutObject({
    accessKeyId,
    bucket: provider.bucket,
    endpoint: provider.endpoint,
    expiresInSeconds,
    forcePathStyle: provider.force_path_style,
    objectKey,
    region: provider.kind === "r2" ? provider.region || "auto" : provider.region || "us-east-1",
    secretAccessKey,
    sessionToken: sessionToken || null,
  })
  const publicBaseUrl = provider.public_base_url?.replace(/\/+$/, "")

  return {
    provider_code: provider.code,
    storage_provider: provider.kind,
    method: "PUT",
    upload_url: signed.url,
    public_url: publicBaseUrl
      ? `${publicBaseUrl}/${encodeObjectPath(objectKey)}`
      : signed.publicUrl,
    bucket: provider.bucket,
    object_key: objectKey,
    expires_at: expiresAt,
    headers: input.mimeType ? { "content-type": input.mimeType } : {},
  }
}

function parseProviderConfigs(
  env: Record<string, string | undefined>,
  runtimeIssues: string[]
) {
  const raw = text(env.CONTENT_STORAGE_PROVIDERS_JSON)

  if (!raw) {
    return [
      {
        code: DEFAULT_PROVIDER_CODE,
        label: "Local content storage",
        kind: "local" as ContentStorageProviderKind,
        enabled: true,
        bucket: text(env.CONTENT_STORAGE_LOCAL_ROOT) || "local-content-assets",
        region: null,
        endpoint: null,
        public_base_url: text(env.CONTENT_STORAGE_PUBLIC_BASE_URL) || null,
        access_key_id_env: null,
        access_key_id_configured: false,
        secret_access_key_env: null,
        secret_access_key_configured: false,
        session_token_env: null,
        session_token_configured: false,
        force_path_style: true,
        site_ids: [],
        upload_strategy: "record_only" as const,
        status: "configured" as ContentStorageProviderStatus,
        issues: [],
        metadata: null,
      },
    ]
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    runtimeIssues.push("CONTENT_STORAGE_PROVIDERS_JSON is not valid JSON")
    return []
  }

  if (!Array.isArray(parsed)) {
    runtimeIssues.push("CONTENT_STORAGE_PROVIDERS_JSON must be a JSON array")
    return []
  }

  return parsed.map((entry, index) => providerFromEntry(entry, index, env))
}

function providerFromEntry(
  entry: unknown,
  index: number,
  env: Record<string, string | undefined>
): ContentStorageProviderConfigSafe {
  const issues: string[] = []
  const source = isRecord(entry) ? entry : {}

  if (!isRecord(entry)) {
    issues.push("Storage provider config must be a JSON object")
  }

  const code = normalizeCode(
    readText(source, ["code", "id", "name"]) || `storage-${index + 1}`,
    issues,
    { fallback: "storage", label: "Storage provider" }
  )
  const kind = normalizeKind(readText(source, ["kind", "provider", "type"]), issues)
  const label = readText(source, ["label", "display_name", "title"]) || code
  const enabled = readBoolean(source, "enabled", true)
  const bucket = readText(source, ["bucket", "bucket_name", "container"]) || null
  const region = readText(source, ["region"]) || null
  const endpoint = normalizeBaseUrl(readText(source, ["endpoint", "endpoint_url", "base_url"]))
  const publicBaseUrl = normalizeBaseUrl(
    readText(source, ["public_base_url", "publicBaseUrl", "cdn_base_url", "cdnBaseUrl"])
  )
  const accessKeyIdEnv =
    readText(source, ["access_key_id_env", "accessKeyIdEnv", "access_key_env"]) || null
  const secretAccessKeyEnv =
    readText(source, ["secret_access_key_env", "secretAccessKeyEnv", "secret_key_env"]) || null
  const sessionTokenEnv =
    readText(source, ["session_token_env", "sessionTokenEnv"]) || null
  const forcePathStyle = readBoolean(
    source,
    "force_path_style",
    kind === "r2" || Boolean(endpoint)
  )
  const uploadStrategy = normalizeUploadStrategy(readText(source, ["upload_strategy", "uploadStrategy"]))
  const siteIds = readStringArray(source, ["site_ids", "siteIds"])
  const metadata = sanitizeMetadata(readRecord(source, "metadata"))

  if (hasInlineSecret(source, STORAGE_INLINE_SECRET_ALLOWLIST)) {
    issues.push("Inline secret-like fields are ignored; reference env names instead")
  }

  if (accessKeyIdEnv && !ENV_NAME_PATTERN.test(accessKeyIdEnv)) {
    issues.push("access_key_id_env must be an environment variable name")
  }

  if (secretAccessKeyEnv && !ENV_NAME_PATTERN.test(secretAccessKeyEnv)) {
    issues.push("secret_access_key_env must be an environment variable name")
  }

  if (sessionTokenEnv && !ENV_NAME_PATTERN.test(sessionTokenEnv)) {
    issues.push("session_token_env must be an environment variable name")
  }

  const accessKeyConfigured = Boolean(accessKeyIdEnv && text(env[accessKeyIdEnv]))
  const secretKeyConfigured = Boolean(secretAccessKeyEnv && text(env[secretAccessKeyEnv]))
  const sessionTokenConfigured = Boolean(
    sessionTokenEnv && text(env[sessionTokenEnv])
  )

  return {
    code,
    label,
    kind,
    enabled,
    bucket,
    region,
    endpoint,
    public_base_url: publicBaseUrl,
    access_key_id_env: accessKeyIdEnv,
    access_key_id_configured: accessKeyConfigured,
    secret_access_key_env: secretAccessKeyEnv,
    secret_access_key_configured: secretKeyConfigured,
    session_token_env: sessionTokenEnv,
    session_token_configured: sessionTokenConfigured,
    force_path_style: forcePathStyle,
    site_ids: siteIds,
    upload_strategy: uploadStrategy,
    status: resolveStatus({
      enabled,
      kind,
      bucket,
      issues,
      accessKeyIdEnv,
      accessKeyConfigured,
      secretAccessKeyEnv,
      secretKeyConfigured,
    }),
    issues,
    metadata,
  }
}

function resolveStatus(input: {
  enabled: boolean
  kind: ContentStorageProviderKind
  bucket: string | null
  issues: string[]
  accessKeyIdEnv: string | null
  accessKeyConfigured: boolean
  secretAccessKeyEnv: string | null
  secretKeyConfigured: boolean
}): ContentStorageProviderStatus {
  if (!input.enabled) {
    return "disabled"
  }

  if (input.issues.length) {
    return "invalid"
  }

  if ((input.kind === "s3" || input.kind === "r2") && !input.bucket) {
    return "missing_bucket"
  }

  if (input.kind === "s3" || input.kind === "r2") {
    if (!input.accessKeyIdEnv || !input.secretAccessKeyEnv) {
      return "missing_secret"
    }

    if (!input.accessKeyConfigured || !input.secretKeyConfigured) {
      return "missing_secret"
    }
  }

  return "configured"
}

function normalizeKind(value: string, issues: string[]): ContentStorageProviderKind {
  if (value === "local" || value === "s3" || value === "r2" || value === "external") {
    return value
  }

  if (value) {
    issues.push("Storage provider kind must be local, s3, r2, or external")
  }

  return "external"
}

function normalizeUploadStrategy(value: string) {
  if (
    value === "record_only" ||
    value === "direct" ||
    value === "backend_proxy" ||
    value === "external"
  ) {
    return value
  }

  return "record_only"
}

function normalizePathSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "item"
}

function normalizeFilename(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[/\\]+/g, "-")
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "asset.bin"
  )
}

function presignS3PutObject(input: {
  accessKeyId: string
  bucket: string
  endpoint: string | null
  expiresInSeconds: number
  forcePathStyle: boolean
  objectKey: string
  region: string
  secretAccessKey: string
  sessionToken?: string | null
}) {
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "")
  const dateStamp = amzDate.slice(0, 8)
  const service = "s3"
  const scope = `${dateStamp}/${input.region}/${service}/aws4_request`
  const endpoint = resolveS3Endpoint(input)
  const host = endpoint.host
  const encodedObjectKey = encodeObjectPath(input.objectKey)
  const canonicalUri = input.forcePathStyle
    ? `/${encodePathSegment(input.bucket)}/${encodedObjectKey}`
    : `/${encodedObjectKey}`
  const publicUrl = `${endpoint.origin}${canonicalUri}`
  const credential = `${input.accessKeyId}/${scope}`
  const queryParams: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(input.expiresInSeconds),
    "X-Amz-SignedHeaders": "host",
  }

  // Temporary (STS / assumed-role) credentials must carry the security token in
  // the canonical query string so it is covered by the signature.
  if (input.sessionToken) {
    queryParams["X-Amz-Security-Token"] = input.sessionToken
  }

  // SigV4 requires the canonical query string to be sorted by RFC3986-encoded
  // key, with every key and value individually RFC3986-encoded.
  const canonicalQuery = Object.keys(queryParams)
    .map((key) => [encodeRfc3986(key), encodeRfc3986(queryParams[key])])
    .sort((left, right) => (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("&")
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n")
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256(canonicalRequest),
  ].join("\n")
  const signingKey = hmacBuffer(
    hmacBuffer(
      hmacBuffer(hmacBuffer(`AWS4${input.secretAccessKey}`, dateStamp), input.region),
      service
    ),
    "aws4_request"
  )
  const signature = crypto
    .createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex")

  // The signature is excluded from the canonical request; its position in the
  // returned URL is irrelevant because S3 re-sorts received parameters.
  return {
    publicUrl,
    url: `${publicUrl}?${canonicalQuery}&X-Amz-Signature=${signature}`,
  }
}

function resolveS3Endpoint(input: {
  bucket: string
  endpoint: string | null
  forcePathStyle: boolean
  region: string
}) {
  const endpoint =
    input.endpoint ||
    (input.forcePathStyle
      ? `https://s3.${input.region}.amazonaws.com`
      : `https://${input.bucket}.s3.${input.region}.amazonaws.com`)
  const parsed = new URL(endpoint)

  if (!input.forcePathStyle && input.endpoint) {
    parsed.hostname = `${input.bucket}.${parsed.hostname}`
  }

  return {
    host: parsed.host,
    origin: parsed.origin,
  }
}

function encodeObjectPath(value: string) {
  return value.split("/").map(encodePathSegment).join("/")
}

function encodePathSegment(value: string) {
  return encodeRfc3986(value)
}

function encodeRfc3986(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function hmacBuffer(key: string | Buffer, value: string) {
  return crypto.createHmac("sha256", key).update(value).digest()
}

