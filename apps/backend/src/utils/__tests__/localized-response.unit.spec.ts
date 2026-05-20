import type { MedusaRequest } from "@medusajs/framework/http"
import { localizedMessage, resolveRequestLocale } from "../localized-response"

function requestWithHeaders(headers: Record<string, string>): MedusaRequest {
  return {
    headers,
  } as MedusaRequest
}

describe("localized response helpers", () => {
  it("defaults to English", () => {
    const req = requestWithHeaders({})

    expect(resolveRequestLocale(req)).toBe("en")
    expect(localizedMessage(req, "marketing.disabled")).toBe(
      "Marketing engine plugin is disabled"
    )
  })

  it("uses explicit admin locale before accept-language", () => {
    const req = requestWithHeaders({
      "x-admin-locale": "zh-CN",
      "accept-language": "en-US,en;q=0.9",
    })

    expect(resolveRequestLocale(req)).toBe("zh-CN")
    expect(localizedMessage(req, "paymentChannel.required")).toBe(
      "必须提供 code、name 和 display_name"
    )
  })

  it("interpolates localized params", () => {
    const req = requestWithHeaders({
      "accept-language": "zh-CN,zh;q=0.9",
    })

    expect(
      localizedMessage(req, "supplier.providerNotRegistered", {
        providerCode: "demo",
      })
    ).toBe("供应商 demo 尚未注册")
  })

  it("respects accept-language order", () => {
    const req = requestWithHeaders({
      "accept-language": "en-US,en;q=0.9,zh-CN;q=0.8",
    })

    expect(resolveRequestLocale(req)).toBe("en")
  })
})
