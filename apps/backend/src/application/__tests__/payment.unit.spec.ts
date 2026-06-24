import {
  createStorefrontPaymentApplication,
  type StorefrontPaymentRepository,
} from "../payment"

describe("storefront payment application", () => {
  it("lists available payment methods through the neutral repository contract", async () => {
    const repository = createRepository()
    repository.listAvailablePaymentChannels.mockResolvedValue([
      {
        id: "channel_1",
        code: "plisio",
        display_name: "Crypto payment",
        type: "crypto",
        priority: 10,
        health_status: "healthy",
      },
    ])
    const payment = createStorefrontPaymentApplication(repository)

    await expect(
      payment.listPaymentMethods({
        amount: "1250.5",
        currency: " USD ",
      })
    ).resolves.toEqual([
      {
        id: "channel_1",
        code: "plisio",
        display_name: "Crypto payment",
        type: "crypto",
        priority: 10,
        health_status: "healthy",
      },
    ])

    expect(repository.listAvailablePaymentChannels).toHaveBeenCalledWith({
      amount: 1250.5,
      currency: "usd",
    })
  })

  it("keeps the public payment method dto independent from adapter fields", async () => {
    const repository = createRepository()
    repository.listAvailablePaymentChannels.mockResolvedValue([
      {
        id: "channel_1",
        code: "manual",
        display_name: "Manual payment",
        type: "manual",
        priority: 100,
        health_status: "degraded",
        provider_code: "manual",
      },
    ])
    const payment = createStorefrontPaymentApplication(repository)

    await expect(payment.listPaymentMethods()).resolves.toEqual([
      {
        id: "channel_1",
        code: "manual",
        display_name: "Manual payment",
        type: "manual",
        priority: 100,
        health_status: "degraded",
      },
    ])
  })

  it("drops invalid amount and currency filters before calling the repository", async () => {
    const repository = createRepository()
    repository.listAvailablePaymentChannels.mockResolvedValue([])
    const payment = createStorefrontPaymentApplication(repository)

    await payment.listPaymentMethods({
      amount: "-1",
      currency: "usd1",
    })

    expect(repository.listAvailablePaymentChannels).toHaveBeenCalledWith({
      amount: undefined,
      currency: undefined,
    })
  })

  it("creates cart payment attempts through the neutral repository contract", async () => {
    const repository = createRepository()
    const items = [{ id: "item_1", quantity: 2 }]
    repository.loadCartPaymentContext.mockResolvedValue({
      amount: 4200,
      currency: "usd",
      customerEmail: "buyer@example.com",
      itemCount: 1,
      items,
    })
    repository.createCartPaymentAttempt.mockResolvedValue({
      attempt: {
        id: "attempt_1",
        cart_id: "cart_1",
        provider_order_id: "provider_1",
        amount: 4200,
        currency: "usd",
        status: "pending",
        provider_code: "plisio",
        payment_url: "https://pay.example/1",
        qr_code_url: null,
        expires_at: "2026-06-24T00:00:00.000Z",
      },
      instructions: {
        title: "Pay now",
        body: "Send payment",
        reference: "attempt_1",
      },
      claimToken: "claim_1",
      marketingContext: {
        tags: ["coupon"],
      },
    })
    const payment = createStorefrontPaymentApplication(repository)

    await expect(
      payment.createCartPayment({
        cartId: " cart_1 ",
        paymentMethod: " plisio ",
        marketing: {
          coupon_code: " SAVE10 ",
          referral_code: "",
          utm_source: " newsletter ",
          utm_medium: " email ",
          ignored: "field",
        },
        analytics: {
          ga_client_id: " client.1 ",
          ga_session_id: "",
          page_location: " https://store.example/checkout ",
          page_path: " /checkout ",
          referrer: 42,
        },
      })
    ).resolves.toEqual({
      attempt: {
        id: "attempt_1",
        cart_id: "cart_1",
        provider_order_id: "provider_1",
        amount: 4200,
        currency: "usd",
        status: "pending",
        provider_code: "plisio",
        payment_url: "https://pay.example/1",
        qr_code_url: null,
        expires_at: "2026-06-24T00:00:00.000Z",
      },
      instructions: {
        title: "Pay now",
        body: "Send payment",
        reference: "attempt_1",
      },
      claim_token: "claim_1",
      marketing: {
        tags: ["coupon"],
      },
    })

    expect(repository.loadCartPaymentContext).toHaveBeenCalledWith("cart_1")
    expect(repository.createCartPaymentAttempt).toHaveBeenCalledWith({
      cartId: "cart_1",
      amount: 4200,
      currency: "usd",
      paymentMethod: "plisio",
      customerEmail: "buyer@example.com",
      metadata: {
        item_count: 1,
        analytics_context: {
          ga_client_id: "client.1",
          ga_session_id: undefined,
          page_location: "https://store.example/checkout",
          page_path: "/checkout",
          referrer: undefined,
        },
      },
      marketing: {
        coupon_code: "SAVE10",
        referral_code: undefined,
        utm_source: "newsletter",
        utm_medium: "email",
        utm_campaign: undefined,
        utm_content: undefined,
        utm_term: undefined,
      },
      items,
    })
  })

  it("keeps the public cart payment dto independent from adapter fields", async () => {
    const repository = createRepository()
    repository.loadCartPaymentContext.mockResolvedValue({
      amount: 100,
      currency: "usd",
      itemCount: 1,
      items: [{ id: "item_1" }],
    })
    repository.createCartPaymentAttempt.mockResolvedValue({
      attempt: {
        id: "attempt_1",
        cart_id: "cart_1",
        provider_order_id: null,
        amount: 100,
        currency: "usd",
        status: "pending",
        provider_code: "manual",
        payment_url: null,
        qr_code_url: null,
        expires_at: null,
        response_payload: { provider_secret: "hidden" },
      } as any,
    })
    const payment = createStorefrontPaymentApplication(repository)

    await expect(
      payment.createCartPayment({
        cartId: "cart_1",
        paymentMethod: "manual",
      })
    ).resolves.toEqual({
      attempt: {
        id: "attempt_1",
        cart_id: "cart_1",
        provider_order_id: null,
        amount: 100,
        currency: "usd",
        status: "pending",
        provider_code: "manual",
        payment_url: null,
        qr_code_url: null,
        expires_at: null,
      },
      instructions: undefined,
      claim_token: undefined,
      marketing: undefined,
    })
  })
})

function createRepository() {
  return {
    listAvailablePaymentChannels: jest.fn(),
    loadCartPaymentContext: jest.fn(),
    createCartPaymentAttempt: jest.fn(),
  } satisfies jest.Mocked<StorefrontPaymentRepository>
}
