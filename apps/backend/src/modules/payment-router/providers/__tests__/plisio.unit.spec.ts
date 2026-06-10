import crypto from "crypto"
import {
  assertPlisioWebhookSignature,
  buildPlisioCallbackUrl,
  formatMinorAmountForPlisio,
  mapPlisioWebhookStatus,
  plisioPaymentProvider,
} from "../plisio"

describe("plisio payment provider", () => {
  const originalEnv = process.env
  const originalFetch = global.fetch

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      PLISIO_API_KEY: "plisio-secret",
      PLISIO_CALLBACK_BASE_URL: "https://api.example.com",
      PLISIO_API_BASE_URL: "https://api.plisio.test/api/v1",
      PLISIO_DEFAULT_CRYPTO_CURRENCY: "USDT",
      PLISIO_EXPIRE_MINUTES: "45",
      STOREFRONT_PUBLIC_URL: "https://store.example.com",
    }
    global.fetch = jest.fn() as unknown as typeof fetch
  })

  afterEach(() => {
    process.env = originalEnv
    global.fetch = originalFetch
  })

  it("reports whether required Plisio config is present", () => {
    expect(plisioPaymentProvider.isConfigured?.()).toBe(true)

    process.env = {
      ...originalEnv,
      PLISIO_API_KEY: "plisio-secret",
    }

    expect(plisioPaymentProvider.isConfigured?.()).toBe(false)
  })

  it("creates a Plisio invoice with fiat source amount and JSON callback", async () => {
    ;(global.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          status: "success",
          data: {
            txn_id: "txn_123",
            invoice_url: "https://plisio.test/invoice/txn_123",
            qr_code: "data:image/png;base64,abc",
            expire_utc: 1_800_000_000,
            currency: "USDT",
          },
        })
      ),
    })

    const result = await plisioPaymentProvider.createPayment({
      cartId: "cart_123",
      amount: 1299,
      currency: "usd",
      paymentMethod: "plisio",
      customerEmail: "buyer@example.com",
      channelConfig: {
        allowed_psys_cids: "USDT,USDC",
      },
    })

    expect(result).toMatchObject({
      providerOrderId: "txn_123",
      paymentUrl: "https://plisio.test/invoice/txn_123",
      qrCodeUrl: "data:image/png;base64,abc",
    })
    expect(result.expiresAt?.toISOString()).toBe("2027-01-15T08:00:00.000Z")

    const [url] = (global.fetch as unknown as jest.Mock).mock.calls[0]
    const requestUrl = new URL(String(url))
    expect(requestUrl.toString()).toContain(
      "https://api.plisio.test/api/v1/invoices/new"
    )
    expect(requestUrl.searchParams.get("source_currency")).toBe("USD")
    expect(requestUrl.searchParams.get("source_amount")).toBe("12.99")
    expect(requestUrl.searchParams.get("currency")).toBe("USDT")
    expect(requestUrl.searchParams.get("allowed_psys_cids")).toBe("USDT,USDC")
    expect(requestUrl.searchParams.get("expire_min")).toBe("45")
    expect(requestUrl.searchParams.get("callback_url")).toBe(
      "https://api.example.com/hooks/payment/plisio?json=true"
    )
    expect(requestUrl.searchParams.get("api_key")).toBe("plisio-secret")
  })

  it("formats minor amounts for common currency exponents", () => {
    expect(formatMinorAmountForPlisio(1299, "usd")).toBe("12.99")
    expect(formatMinorAmountForPlisio(1000, "jpy")).toBe("1000")
    expect(formatMinorAmountForPlisio(1234, "kwd")).toBe("1.234")
  })

  it("validates Plisio JSON webhook signatures", () => {
    const payload = {
      txn_id: "txn_123",
      status: "completed",
      order_number: "cart_123",
      verify_hash: "",
    }
    const signedPayload = {
      ...payload,
    }
    delete (signedPayload as Record<string, unknown>).verify_hash
    payload.verify_hash = crypto
      .createHmac("sha1", "plisio-secret")
      .update(JSON.stringify(signedPayload))
      .digest("hex")

    expect(() =>
      assertPlisioWebhookSignature(payload, "plisio-secret")
    ).not.toThrow()
    expect(() =>
      assertPlisioWebhookSignature(
        {
          ...payload,
          verify_hash: "bad",
        },
        "plisio-secret"
      )
    ).toThrow("Invalid Plisio webhook signature")
  })

  it("maps Plisio callback statuses to terminal payment statuses", () => {
    expect(mapPlisioWebhookStatus("completed")).toBe("paid")
    expect(mapPlisioWebhookStatus("pending internal")).toBe("pending")
    expect(mapPlisioWebhookStatus("cancelled duplicate")).toBe("expired")
    expect(mapPlisioWebhookStatus("error")).toBe("failed")
  })

  it("builds callback URLs with json=true for non-PHP webhook verification", () => {
    expect(buildPlisioCallbackUrl("https://api.example.com")).toBe(
      "https://api.example.com/hooks/payment/plisio?json=true"
    )
  })
})
