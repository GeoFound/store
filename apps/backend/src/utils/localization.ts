export type SupportedLocale = "en" | "zh-CN"

export const DEFAULT_LOCALE: SupportedLocale = "en"

export function resolveLocaleFromValue(value?: string | null) {
  if (!value) {
    return undefined
  }

  const languageTags = value
    .split(",")
    .map((part) => part.trim().split(";")[0]?.toLowerCase())
    .filter((tag): tag is string => Boolean(tag))

  for (const tag of languageTags) {
    if (tag === "zh" || tag.startsWith("zh-")) {
      return "zh-CN"
    }

    if (tag === "en" || tag.startsWith("en-")) {
      return "en"
    }
  }

  return undefined
}

export function resolveLocaleFromHeaders(headers?: Record<string, unknown>) {
  if (!headers) {
    return DEFAULT_LOCALE
  }

  const explicitLocale =
    firstHeader(headers, "x-admin-locale") ||
    firstHeader(headers, "x-store-locale")
  const resolvedExplicit = resolveLocaleFromValue(explicitLocale)

  if (resolvedExplicit) {
    return resolvedExplicit
  }

  return resolveLocaleFromValue(firstHeader(headers, "accept-language")) || DEFAULT_LOCALE
}

export function interpolateText(
  template: string,
  params: Record<string, string | number | boolean | null | undefined>
) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = params[key]
    return value === null || typeof value === "undefined" ? "" : String(value)
  })
}

export function localizeText(
  input: Partial<Record<SupportedLocale, string>>,
  locale?: string | null,
  fallback = ""
) {
  const resolved = resolveLocaleFromValue(locale)
  if (resolved && input[resolved]) {
    return input[resolved] as string
  }

  return input.en || input["zh-CN"] || fallback
}

export function translateServiceErrorMessage(
  locale: string | null | undefined,
  message: string
) {
  const resolvedLocale = resolveLocaleFromValue(locale)

  if (resolvedLocale !== "zh-CN") {
    return message
  }

  for (const rule of SERVICE_ERROR_TRANSLATIONS) {
    if ("match" in rule) {
      if (rule.match === message) {
        return rule.zh
      }
    } else {
      const match = message.match(rule.pattern)
      if (!match) {
        continue
      }

      return interpolateText(rule.zh, rule.map(match))
    }
  }

  return message
}

const SERVICE_ERROR_TRANSLATIONS: Array<
  | {
      match: string
      zh: string
    }
  | {
      pattern: RegExp
      zh: string
      map: (match: RegExpMatchArray) => Record<string, string>
    }
> = [
  {
    match: "Access token has expired",
    zh: "访问令牌已过期",
  },
  {
    match: "Access token has been revoked",
    zh: "访问令牌已撤销",
  },
  {
    match: "Access token is temporarily blocked",
    zh: "访问令牌已临时封禁",
  },
  {
    match: "Access token was not found",
    zh: "未找到访问令牌",
  },
  {
    match: "Cart email is required before order creation",
    zh: "创建订单前必须提供购物车邮箱",
  },
  {
    match: "Cart currency is required before order creation",
    zh: "创建订单前必须提供购物车币种",
  },
  {
    match: "Cart must contain at least one item",
    zh: "购物车必须至少包含一个商品",
  },
  {
    match: "Cart was not found",
    zh: "未找到购物车",
  },
  {
    match: "Each item requires credential",
    zh: "每个项目都必须包含 credential",
  },
  {
    match: "items must include at least one credential",
    zh: "items 必须至少包含一条凭证",
  },
  {
    match: "code and name are required",
    zh: "必须提供 code 和 name",
  },
  {
    match: "code, name, and display_name are required",
    zh: "必须提供 code、name 和 display_name",
  },
  {
    match: "code is required",
    zh: "必须提供 code",
  },
  {
    match: "Coupon has expired",
    zh: "优惠券已过期",
  },
  {
    match: "Coupon is not active yet",
    zh: "优惠券尚未生效",
  },
  {
    match: "Coupon reached maximum redemptions",
    zh: "优惠券已达到最大兑换次数",
  },
  {
    match: "Coupon usage limit reached for this email",
    zh: "该邮箱已达到优惠券使用上限",
  },
  {
    match: "Guest checkout cart must have an email",
    zh: "访客结账购物车必须包含邮箱",
  },
  {
    match: "Guest checkout requires an email before payment",
    zh: "访客结账在支付前必须提供邮箱",
  },
  {
    match: "id is required",
    zh: "必须提供 id",
  },
  {
    match: "Invalid coupon code",
    zh: "无效的优惠券代码",
  },
  {
    match: "Invalid referral code",
    zh: "无效的推荐代码",
  },
  {
    match: "Order was not found",
    zh: "未找到订单",
  },
  {
    match: "Payment currency must be a valid 3-letter code",
    zh: "支付币种必须是有效的 3 位字母代码",
  },
  {
    match: "product_variant_id and reservation_key are required",
    zh: "必须提供 product_variant_id 和 reservation_key",
  },
  {
    match: "product_variant_id, provider_code, and provider_sku are required",
    zh: "必须提供 product_variant_id、provider_code 和 provider_sku",
  },
  {
    match: "name and product_variant_id are required",
    zh: "必须提供 name 和 product_variant_id",
  },
  {
    match: "Recovery code is invalid",
    zh: "恢复验证码无效",
  },
  {
    match: "Recovery code was not found",
    zh: "未找到恢复验证码",
  },
  {
    match: "Recovery code was recently issued. Please wait before requesting another code.",
    zh: "恢复验证码刚刚签发，请稍后再请求新的验证码。",
  },
  {
    match: "Selected payment method is not available",
    zh: "所选支付方式不可用",
  },
  {
    match: "currency must be a valid 3-letter code",
    zh: "currency 必须是有效的 3 位字母代码",
  },
  {
    match: "dispatch_id is required",
    zh: "必须提供 dispatch_id",
  },
  {
    match: "message is required",
    zh: "必须提供 message",
  },
  {
    match: "Too many invalid recovery attempts. Please retry later.",
    zh: "无效恢复尝试过多，请稍后重试。",
  },
  {
    match: "Too many requests",
    zh: "请求过于频繁",
  },
  {
    pattern: /^Cannot mark payment attempt with status (.+) as paid$/,
    zh: "无法将状态为 {{status}} 的支付尝试标记为已支付",
    map: (match) => ({ status: match[1] }),
  },
  {
    pattern: /^Payment provider (.+) is not registered$/,
    zh: "支付提供方 {{provider}} 尚未注册",
    map: (match) => ({ provider: match[1] }),
  },
  {
    pattern: /^Supplier provider (.+) is not registered$/,
    zh: "供应商提供方 {{provider}} 尚未注册",
    map: (match) => ({ provider: match[1] }),
  },
  {
    pattern: /^Unknown template_code: (.+)$/,
    zh: "未知 template_code：{{templateCode}}",
    map: (match) => ({ templateCode: match[1] }),
  },
  {
    pattern: /^(.+) is required$/,
    zh: "必须提供 {{field}}",
    map: (match) => ({ field: match[1] }),
  },
  {
    pattern: /^(.+) must be 2-64 chars of A-Z, 0-9, _, -$/,
    zh: "{{field}} 必须为 2-64 个字符，仅允许 A-Z、0-9、_、-",
    map: (match) => ({ field: match[1] }),
  },
]

function firstHeader(headers: Record<string, unknown>, name: string) {
  const value = headers[name] ?? headers[name.toLowerCase()]

  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined
  }

  return typeof value === "string" ? value : undefined
}
