import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PLATFORM_HOOKS } from "../../platform/hooks"
import { registerPlatformHook } from "../../platform/runtime"
import type { NotificationSendHookInput } from "../../utils/notification"
import { assertResendConfig } from "./config"
import { renderNotificationEmailTemplate } from "./templates"

type ResendEmailRequestBody = {
  from: string
  to: string[]
  subject: string
  text: string
  html: string
  reply_to?: string[]
}

let hooksRegistered = false

export function ensureNotificationResendHooksRegistered() {
  if (hooksRegistered) {
    return
  }

  registerPlatformHook<NotificationSendHookInput>({
    hook: PLATFORM_HOOKS.notificationSend,
    pluginId: "notification-resend",
    name: "notification-resend.notification-send",
    version: "v1",
    enabled: true,
    handler: async (input) => {
      const config = assertResendConfig()

      if (!config.enabled || input.channel !== "email") {
        return
      }

      const template = renderNotificationEmailTemplate({
        template: input.template,
        data: input.data,
      })

      if (!template) {
        return
      }

      const logger = input.scope.resolve(ContainerRegistrationKeys.LOGGER) as {
        info: (message: string, meta?: Record<string, unknown>) => void
      }
      const requestBody: ResendEmailRequestBody = {
        from: config.fromEmail,
        to: [input.to],
        subject: template.subject,
        text: template.text,
        html: template.html,
      }

      if (config.replyToEmail) {
        requestBody.reply_to = [config.replyToEmail]
      }

      const response = await fetch(`${config.apiBaseUrl}/emails`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const responseBody = (await response.text()).slice(0, 500)
        throw new Error(
          `Resend dispatch failed with status ${response.status}: ${responseBody || "empty response"}`
        )
      }

      const responsePayload = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >

      logger.info("Resend notification dispatched", {
        template: input.template,
        channel: input.channel,
        to: input.to,
        resend_message_id:
          typeof responsePayload?.id === "string" ? responsePayload.id : null,
      })
    },
  })

  hooksRegistered = true
}

export function resetNotificationResendHooksForTests() {
  hooksRegistered = false
}
