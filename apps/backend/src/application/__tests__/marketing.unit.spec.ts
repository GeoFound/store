import {
  createStorefrontMarketingApplication,
  type StorefrontMarketingRepository,
} from "../marketing"

describe("storefront marketing application", () => {
  it("lists active public campaigns through the neutral repository contract", async () => {
    const repository = createRepository()
    repository.listCampaigns.mockResolvedValue([{ id: "campaign_1" }])
    const marketing = createStorefrontMarketingApplication(repository)

    await expect(
      marketing.listPublicCampaigns({
        limit: "500",
      })
    ).resolves.toEqual([{ id: "campaign_1" }])

    expect(repository.listCampaigns).toHaveBeenCalledWith({
      status: "active",
      limit: 200,
    })
  })

  it("falls back to the storefront default campaign limit", async () => {
    const repository = createRepository()
    repository.listCampaigns.mockResolvedValue([])
    const marketing = createStorefrontMarketingApplication(repository)

    await marketing.listPublicCampaigns({
      limit: "not-a-number",
    })

    expect(repository.listCampaigns).toHaveBeenCalledWith({
      status: "active",
      limit: 50,
    })
  })

  it("filters campaigns outside their public time window", async () => {
    const repository = createRepository()
    repository.listCampaigns.mockResolvedValue([
      {
        id: "currently_visible",
        starts_at: "2026-06-01T00:00:00.000Z",
        ends_at: "2026-07-01T00:00:00.000Z",
      },
      {
        id: "future",
        starts_at: "2026-07-01T00:00:00.001Z",
      },
      {
        id: "expired",
        ends_at: "2026-06-01T00:00:00.000Z",
      },
      {
        id: "no_window",
      },
      {
        id: "invalid_window",
        starts_at: "not-a-date",
        ends_at: "also-not-a-date",
      },
    ])
    const marketing = createStorefrontMarketingApplication(repository, {
      now: () => Date.parse("2026-06-15T00:00:00.000Z"),
    })

    await expect(marketing.listPublicCampaigns()).resolves.toEqual([
      {
        id: "currently_visible",
        starts_at: "2026-06-01T00:00:00.000Z",
        ends_at: "2026-07-01T00:00:00.000Z",
      },
      {
        id: "no_window",
      },
      {
        id: "invalid_window",
        starts_at: "not-a-date",
        ends_at: "also-not-a-date",
      },
    ])
  })
})

function createRepository() {
  return {
    listCampaigns: jest.fn(),
  } satisfies jest.Mocked<StorefrontMarketingRepository>
}
