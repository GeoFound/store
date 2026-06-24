import {
  ContentApplicationError,
  createStorefrontContentApplication,
  type StorefrontContentRepository,
} from "../content"

describe("storefront content application", () => {
  it("lists published content through the neutral repository contract", async () => {
    const repository = createRepository()
    repository.listPublishedEntries.mockResolvedValue([{ id: "entry_1" }])
    const content = createStorefrontContentApplication(repository)

    await expect(
      content.listPublishedEntries({
        siteId: " site_jp ",
        contentType: " guide ",
        topic: " payments ",
        tag: " release ",
        limit: "500",
      })
    ).resolves.toEqual([{ id: "entry_1" }])

    expect(repository.listPublishedEntries).toHaveBeenCalledWith({
      siteId: "site_jp",
      contentType: "guide",
      topic: "payments",
      tag: "release",
      limit: 200,
    })
  })

  it("retrieves published content by slug through the neutral repository contract", async () => {
    const repository = createRepository()
    repository.retrievePublishedEntryBySlug.mockResolvedValue({
      id: "entry_1",
      slug: "refund-guide",
    })
    const content = createStorefrontContentApplication(repository)

    await expect(
      content.getPublishedEntryBySlug({
        slug: " refund-guide ",
        siteId: "site_us",
      })
    ).resolves.toEqual({
      id: "entry_1",
      slug: "refund-guide",
    })

    expect(repository.retrievePublishedEntryBySlug).toHaveBeenCalledWith({
      slug: "refund-guide",
      siteId: "site_us",
    })
  })

  it("rejects missing content slugs before hitting the repository", async () => {
    const repository = createRepository()
    const content = createStorefrontContentApplication(repository)

    await expect(
      content.getPublishedEntryBySlug({ slug: "  " })
    ).rejects.toMatchObject({
      code: "invalid_request",
    } satisfies Partial<ContentApplicationError>)

    expect(repository.retrievePublishedEntryBySlug).not.toHaveBeenCalled()
  })

  it("only returns published SEO documents", async () => {
    const repository = createRepository()
    repository.retrieveSeoDocument
      .mockResolvedValueOnce({
        id: "seo_1",
        status: "draft",
      })
      .mockResolvedValueOnce({
        id: "seo_2",
        status: "published",
      })
    const content = createStorefrontContentApplication(repository)

    await expect(
      content.getPublishedSeoDocument({
        entityType: "content_entry",
        entityId: "entry_1",
      })
    ).resolves.toBeNull()
    await expect(
      content.getPublishedSeoDocument({
        entityType: "content_entry",
        entityId: "entry_1",
        siteId: "site_jp",
        language: "ja",
      })
    ).resolves.toEqual({
      id: "seo_2",
      status: "published",
    })

    expect(repository.retrieveSeoDocument).toHaveBeenLastCalledWith({
      entityType: "content_entry",
      entityId: "entry_1",
      siteId: "site_jp",
      language: "ja",
    })
  })

  it("rejects incomplete SEO lookups before hitting the repository", async () => {
    const repository = createRepository()
    const content = createStorefrontContentApplication(repository)

    await expect(
      content.getPublishedSeoDocument({
        entityType: "content_entry",
      })
    ).rejects.toMatchObject({
      code: "invalid_request",
    } satisfies Partial<ContentApplicationError>)

    expect(repository.retrieveSeoDocument).not.toHaveBeenCalled()
  })
})

function createRepository() {
  return {
    listPublishedEntries: jest.fn(),
    retrievePublishedEntryBySlug: jest.fn(),
    retrieveSeoDocument: jest.fn(),
  } satisfies jest.Mocked<StorefrontContentRepository>
}
