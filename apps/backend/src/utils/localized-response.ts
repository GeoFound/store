import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  DEFAULT_LOCALE,
  interpolateText,
  resolveLocaleFromHeaders,
  type SupportedLocale,
} from "./localization"

type LocalizedMessageKey =
  | "ai.disabled"
  | "analytics.disabled"
  | "analytics.dispatchIdRequired"
  | "common.messageRequired"
  | "content.disabled"
  | "content.entryRequired"
  | "credentialBatch.itemCredentialRequired"
  | "credentialBatch.itemsRequired"
  | "credentialBatch.unsupportedVariant"
  | "credentialBatch.required"
  | "credentialBatch.variantNotFound"
  | "credentialReservation.required"
  | "delivery.payloadRequired"
  | "delivery.required"
  | "marketing.codeRequired"
  | "marketing.disabled"
  | "marketing.namedRequired"
  | "orderAccess.guestUnavailable"
  | "orderAccess.orderNotFound"
  | "orderAccess.providerUnavailable"
  | "orderAccess.recoveryCooldown"
  | "paymentChannel.currencyInvalid"
  | "paymentChannel.required"
  | "security.originNotAllowed"
  | "security.tooManyRequests"
  | "supplier.mappingRequired"
  | "supplier.procurementIdRequired"
  | "supplier.providerNotRegistered"
  | "template.unknown"

const messages: Record<LocalizedMessageKey, Record<SupportedLocale, string>> = {
  "ai.disabled": {
    en: "AI core plugin is disabled",
    "zh-CN": "AI 核心插件已停用",
  },
  "analytics.disabled": {
    en: "Analytics core plugin is disabled",
    "zh-CN": "分析核心插件已停用",
  },
  "analytics.dispatchIdRequired": {
    en: "dispatch_id is required",
    "zh-CN": "必须提供 dispatch_id",
  },
  "common.messageRequired": {
    en: "message is required",
    "zh-CN": "必须提供 message",
  },
  "content.disabled": {
    en: "Content core plugin is disabled",
    "zh-CN": "内容核心插件已停用",
  },
  "content.entryRequired": {
    en: "slug and title are required",
    "zh-CN": "必须提供 slug 和 title",
  },
  "credentialBatch.itemCredentialRequired": {
    en: "Each item requires credential",
    "zh-CN": "每个项目都必须包含 credential",
  },
  "credentialBatch.itemsRequired": {
    en: "items must include at least one credential",
    "zh-CN": "items 必须至少包含一条凭证",
  },
  "credentialBatch.unsupportedVariant": {
    en: "Product variant {{variantId}} uses inventory handler {{handlerCode}} and cannot receive credential inventory",
    "zh-CN": "商品规格 {{variantId}} 使用库存 handler {{handlerCode}}，不能导入凭证库存",
  },
  "credentialBatch.required": {
    en: "name and product_variant_id are required",
    "zh-CN": "必须提供 name 和 product_variant_id",
  },
  "credentialBatch.variantNotFound": {
    en: "Product variant {{variantId}} was not found",
    "zh-CN": "未找到商品规格 {{variantId}}",
  },
  "credentialReservation.required": {
    en: "product_variant_id and reservation_key are required",
    "zh-CN": "必须提供 product_variant_id 和 reservation_key",
  },
  "delivery.payloadRequired": {
    en: "delivery_payload is required to complete a pending delivery",
    "zh-CN": "完成待处理交付必须提供 delivery_payload",
  },
  "delivery.required": {
    en: "account_item_id, delivery_payload, or delivery_id is required",
    "zh-CN": "必须提供 account_item_id、delivery_payload 或 delivery_id",
  },
  "marketing.codeRequired": {
    en: "code is required",
    "zh-CN": "必须提供 code",
  },
  "marketing.disabled": {
    en: "Marketing engine plugin is disabled",
    "zh-CN": "营销引擎插件已停用",
  },
  "marketing.namedRequired": {
    en: "code and name are required",
    "zh-CN": "必须提供 code 和 name",
  },
  "orderAccess.guestUnavailable": {
    en: "Guest order access is unavailable",
    "zh-CN": "访客订单访问不可用",
  },
  "orderAccess.orderNotFound": {
    en: "Order was not found",
    "zh-CN": "未找到订单",
  },
  "orderAccess.providerUnavailable": {
    en: "Order access provider is not available",
    "zh-CN": "订单访问提供方不可用",
  },
  "orderAccess.recoveryCooldown": {
    en: "Recovery code was recently issued. Please wait before requesting another code.",
    "zh-CN": "恢复验证码刚刚签发，请稍后再请求新的验证码。",
  },
  "paymentChannel.currencyInvalid": {
    en: "currency must be a valid 3-letter code",
    "zh-CN": "currency 必须是有效的 3 位字母代码",
  },
  "paymentChannel.required": {
    en: "code, name, and display_name are required",
    "zh-CN": "必须提供 code、name 和 display_name",
  },
  "security.originNotAllowed": {
    en: "Request origin is not allowed",
    "zh-CN": "请求来源不被允许",
  },
  "security.tooManyRequests": {
    en: "Too many requests",
    "zh-CN": "请求过于频繁",
  },
  "supplier.mappingRequired": {
    en: "product_variant_id, provider_code, and provider_sku are required",
    "zh-CN": "必须提供 product_variant_id、provider_code 和 provider_sku",
  },
  "supplier.procurementIdRequired": {
    en: "id is required",
    "zh-CN": "必须提供 id",
  },
  "supplier.providerNotRegistered": {
    en: "Supplier provider {{providerCode}} is not registered",
    "zh-CN": "供应商 {{providerCode}} 尚未注册",
  },
  "template.unknown": {
    en: "Unknown template_code: {{templateCode}}",
    "zh-CN": "未知 template_code：{{templateCode}}",
  },
}

export function localizedMessage(
  req: MedusaRequest,
  key: LocalizedMessageKey,
  params: Record<string, string | number | boolean | null | undefined> = {}
) {
  const locale = resolveRequestLocale(req)
  return interpolate(messages[key][locale], params)
}

export function localizedError(
  req: MedusaRequest,
  res: MedusaResponse,
  status: number,
  key: LocalizedMessageKey,
  params?: Record<string, string | number | boolean | null | undefined>
) {
  res.status(status).json({
    message: localizedMessage(req, key, params),
  })
}

export function resolveRequestLocale(req: MedusaRequest): SupportedLocale {
  return resolveLocaleFromHeaders(req.headers as Record<string, unknown>)
}

const interpolate = interpolateText
