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
})

function createRepository() {
  return {
    listAvailablePaymentChannels: jest.fn(),
  } satisfies jest.Mocked<StorefrontPaymentRepository>
}
