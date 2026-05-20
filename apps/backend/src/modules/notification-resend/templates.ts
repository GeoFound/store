import {
  resolveLocaleFromValue,
  type SupportedLocale,
} from "../../utils/localization"

export type NotificationEmailTemplateInput = {
  template: string
  data: Record<string, unknown>
  locale?: SupportedLocale | string | null
}

export type NotificationEmailTemplateOutput = {
  subject: string
  text: string
  html: string
}

export function renderNotificationEmailTemplate(
  input: NotificationEmailTemplateInput
) {
  if (input.template === "guest-order-recovery") {
    return renderGuestOrderRecoveryTemplate(input.data, input.locale)
  }

  return null
}

function renderGuestOrderRecoveryTemplate(
  data: Record<string, unknown>,
  locale?: string | null
): NotificationEmailTemplateOutput {
  const code = normalizeText(data.code)
  const orderId = normalizeText(data.order_id)
  const expiresAt = normalizeText(data.expires_at)
  const resolvedLocale = resolveLocaleFromValue(locale) || "en"

  if (!code || !orderId) {
    throw new Error(
      "guest-order-recovery template requires order_id and code fields"
    )
  }

  const content = localizedRecoveryCopy(resolvedLocale, {
    orderId,
    code,
    expiresAt,
  })

  return {
    subject: content.subject,
    text: content.text,
    html: content.html,
  }
}

function localizedRecoveryCopy(
  locale: SupportedLocale,
  input: {
    orderId: string
    code: string
    expiresAt?: string | null
  }
) {
  const expiryLine = input.expiresAt
    ? locale === "zh-CN"
      ? `过期时间：${input.expiresAt}`
      : `Expires at: ${input.expiresAt}`
    : locale === "zh-CN"
      ? "大约 15 分钟后过期。"
      : "Expires in about 15 minutes."

  if (locale === "zh-CN") {
    const subject = `订单 ${input.orderId} 的恢复验证码`
    const text = [
      "请使用下面的恢复验证码访问你的订单：",
      "",
      `订单 ID：${input.orderId}`,
      `恢复验证码：${input.code}`,
      expiryLine,
      "",
      "如果你没有请求这封邮件，可以忽略它。",
    ].join("\n")
    const html = [
      "<p>请使用下面的恢复验证码访问你的订单：</p>",
      "<ul>",
      `<li><strong>订单 ID：</strong>${escapeHtml(input.orderId)}</li>`,
      `<li><strong>恢复验证码：</strong>${escapeHtml(input.code)}</li>`,
      `<li><strong>${escapeHtml(expiryLine)}</strong></li>`,
      "</ul>",
      "<p>如果你没有请求这封邮件，可以忽略它。</p>",
    ].join("")

    return {
      subject,
      text,
      html,
    }
  }

  const subject = `Order recovery code for ${input.orderId}`
  const text = [
    "Use the recovery code below to access your order:",
    "",
    `Order ID: ${input.orderId}`,
    `Recovery code: ${input.code}`,
    expiryLine,
    "",
    "If you didn't request this code, please ignore this email.",
  ].join("\n")
  const html = [
    "<p>Use the recovery code below to access your order:</p>",
    "<ul>",
    `<li><strong>Order ID:</strong> ${escapeHtml(input.orderId)}</li>`,
    `<li><strong>Recovery code:</strong> ${escapeHtml(input.code)}</li>`,
    `<li><strong>${escapeHtml(expiryLine)}</strong></li>`,
    "</ul>",
    "<p>If you didn't request this code, please ignore this email.</p>",
  ].join("")

  return {
    subject,
    text,
    html,
  }
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}
