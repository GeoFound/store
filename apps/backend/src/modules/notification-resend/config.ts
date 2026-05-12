import { parseBoolean } from "../analytics-core/config"

export type ResendConfig = {
  enabled: boolean
  apiKey: string
  fromEmail: string
  replyToEmail: string
  apiBaseUrl: string
}

const DEFAULT_RESEND_API_BASE_URL = "https://api.resend.com"

export function getResendConfig(
  env: Record<string, string | undefined> = process.env
): ResendConfig {
  return {
    enabled: parseBoolean(env.RESEND_ENABLED, false),
    apiKey: env.RESEND_API_KEY?.trim() || "",
    fromEmail: env.RESEND_FROM_EMAIL?.trim() || "",
    replyToEmail: env.RESEND_REPLY_TO_EMAIL?.trim() || "",
    apiBaseUrl: (
      env.RESEND_API_BASE_URL?.trim() || DEFAULT_RESEND_API_BASE_URL
    ).replace(/\/+$/, ""),
  }
}

export function assertResendConfig(
  env: Record<string, string | undefined> = process.env
) {
  const config = getResendConfig(env)

  if (!config.enabled) {
    return config
  }

  if (!config.apiKey) {
    throw new Error("RESEND_API_KEY is required when RESEND_ENABLED=true")
  }

  if (!config.fromEmail) {
    throw new Error("RESEND_FROM_EMAIL is required when RESEND_ENABLED=true")
  }

  if (!looksLikeEmailAddress(config.fromEmail)) {
    throw new Error("RESEND_FROM_EMAIL must be a valid email address")
  }

  if (config.replyToEmail && !looksLikeEmailAddress(config.replyToEmail)) {
    throw new Error("RESEND_REPLY_TO_EMAIL must be a valid email address")
  }

  return config
}

function looksLikeEmailAddress(value: string) {
  const normalized = value.trim()
  const bracketMatch = normalized.match(/<([^>]+)>$/)
  const email = bracketMatch ? bracketMatch[1].trim() : normalized

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
