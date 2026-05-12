export type NotificationEmailTemplateInput = {
  template: string
  data: Record<string, unknown>
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
    return renderGuestOrderRecoveryTemplate(input.data)
  }

  return null
}

function renderGuestOrderRecoveryTemplate(
  data: Record<string, unknown>
): NotificationEmailTemplateOutput {
  const code = normalizeText(data.code)
  const orderId = normalizeText(data.order_id)
  const expiresAt = normalizeText(data.expires_at)

  if (!code || !orderId) {
    throw new Error(
      "guest-order-recovery template requires order_id and code fields"
    )
  }

  const expiryLine = expiresAt
    ? `Expires at: ${expiresAt}`
    : "Expires in about 15 minutes."
  const subject = `Order recovery code for ${orderId}`
  const text = [
    "Use the recovery code below to access your order:",
    "",
    `Order ID: ${orderId}`,
    `Recovery code: ${code}`,
    expiryLine,
    "",
    "If you didn't request this code, please ignore this email.",
  ].join("\n")
  const html = [
    "<p>Use the recovery code below to access your order:</p>",
    "<ul>",
    `<li><strong>Order ID:</strong> ${escapeHtml(orderId)}</li>`,
    `<li><strong>Recovery code:</strong> ${escapeHtml(code)}</li>`,
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
