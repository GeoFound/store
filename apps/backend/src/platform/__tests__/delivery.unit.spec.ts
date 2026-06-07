import { resolveDeliveryHandlerCode } from "../delivery"

describe("delivery handler resolution", () => {
  it("prefers explicit handler configuration", () => {
    expect(
      resolveDeliveryHandlerCode({
        deliveryHandlerCode: "file",
        templateDeliveryHandlerCode: "manual",
        deliveryPayload: { download_url: "https://example.com/file" },
      })
    ).toBe("file")
  })

  it("respects template handlers before falling back to manual", () => {
    expect(
      resolveDeliveryHandlerCode({
        templateDeliveryHandlerCode: "api",
        deliveryPayload: { access_url: "https://example.com/provision" },
      })
    ).toBe("api")
  })

  it("uses credential deliveries when an account item is present", () => {
    expect(
      resolveDeliveryHandlerCode({
        templateDeliveryHandlerCode: "manual",
        accountItemId: "acc_1",
        deliveryPayload: { secret: "value" },
      })
    ).toBe("credential")
  })

  it("uses the caller-provided default for ad hoc payload-based deliveries", () => {
    expect(
      resolveDeliveryHandlerCode({
        deliveryPayload: { download_url: "https://example.com/file" },
        defaultHandlerCode: "manual",
      })
    ).toBe("manual")
  })

  it("does not silently guess a default delivery handler", () => {
    expect(
      resolveDeliveryHandlerCode({
        deliveryPayload: { download_url: "https://example.com/file" },
      })
    ).toBeUndefined()
  })
})
