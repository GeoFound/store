import {
  auditContentSeo,
  auditSeoDocumentFields,
  scoreSeoFindings,
} from "../seo-audit"

describe("auditSeoDocumentFields", () => {
  it("flags an empty document with critical findings", () => {
    const findings = auditSeoDocumentFields({ status: "draft" })
    const ids = findings.map((f) => f.id)

    expect(ids).toContain("meta-title-missing")
    expect(ids).toContain("meta-description-missing")
    expect(ids).toContain("structured-data-missing")
    expect(ids).toContain("faq-missing")
    expect(ids).toContain("not-published")
    expect(findings.find((f) => f.id === "meta-title-missing")?.severity).toBe(
      "critical"
    )
  })

  it("passes a well-formed published document", () => {
    const findings = auditSeoDocumentFields({
      meta_title: "Prepaid gift cards delivered instantly",
      meta_description:
        "Buy prepaid gift cards and digital codes with instant delivery to your order page across supported regions.",
      canonical_url: "https://shop.example.com/products/x",
      og_image_url: "https://cdn.example.com/x.png",
      schema_type: "Product",
      faq_json: [{ question: "Q?", answer: "A" }],
      summary_tldr: "Instant prepaid gift cards.",
      status: "published",
    })

    expect(findings).toEqual([])
  })

  it("warns on out-of-range meta lengths", () => {
    const findings = auditSeoDocumentFields({
      meta_title: "Too short",
      meta_description: "Short.",
      schema_type: "Product",
      faq_json: [{ question: "Q?", answer: "A" }],
      summary_tldr: "x",
      canonical_url: "u",
      og_image_url: "i",
      status: "published",
    })
    const ids = findings.map((f) => f.id)

    expect(ids).toContain("meta-title-length")
    expect(ids).toContain("meta-description-length")
    expect(findings.every((f) => f.severity === "warning")).toBe(true)
  })
})

describe("scoreSeoFindings", () => {
  it("subtracts severity-weighted penalties from 100", () => {
    expect(scoreSeoFindings([])).toBe(100)
    expect(
      scoreSeoFindings([
        { id: "a", severity: "critical", field: "x", message: "" },
        { id: "b", severity: "warning", field: "y", message: "" },
        { id: "c", severity: "info", field: "z", message: "" },
      ])
    ).toBe(100 - 25 - 10 - 3)
  })

  it("never goes below zero", () => {
    const findings = Array.from({ length: 10 }, (_, i) => ({
      id: `c${i}`,
      severity: "critical" as const,
      field: "x",
      message: "",
    }))
    expect(scoreSeoFindings(findings)).toBe(0)
  })
})

describe("auditContentSeo", () => {
  it("aggregates findings and averages scores across documents", async () => {
    const repo = {
      listContentSeoDocuments: async () => [
        { id: "1", entity_type: "product", entity_id: "p1", site_id: "global", language: "*", status: "draft" },
        {
          id: "2",
          entity_type: "content_entry",
          entity_id: "c1",
          site_id: "global",
          language: "*",
          meta_title: "A perfectly reasonable content title here",
          meta_description:
            "A meta description of an appropriate length that comfortably sits within the recommended range for search snippets.",
          schema_type: "Article",
          faq_json: [{ question: "Q?", answer: "A" }],
          summary_tldr: "tldr",
          canonical_url: "u",
          og_image_url: "i",
          status: "published",
        },
      ],
    }

    const report = await auditContentSeo(repo)

    expect(report.summary.documents).toBe(2)
    expect(report.summary.critical).toBeGreaterThan(0)
    expect(report.results).toHaveLength(2)
    expect(report.summary.average_score).toBeLessThan(100)
    expect(report.results[0].performance).toBeNull()
  })

  it("joins Search Console performance by canonical URL and flags low CTR", async () => {
    const repo = {
      listContentSeoDocuments: async () => [
        {
          id: "1",
          entity_type: "product",
          entity_id: "p1",
          site_id: "global",
          language: "*",
          meta_title: "A perfectly reasonable product title here",
          meta_description:
            "A meta description of an appropriate length that comfortably sits within the recommended range for search snippets.",
          schema_type: "Product",
          faq_json: [{ question: "Q?", answer: "A" }],
          summary_tldr: "tldr",
          canonical_url: "https://shop.example.com/products/x",
          og_image_url: "i",
          status: "published",
        },
      ],
    }

    const report = await auditContentSeo(repo, undefined, [
      {
        key: "https://shop.example.com/products/x/",
        clicks: 1,
        impressions: 400,
        ctr: 0.0025,
        position: 18,
      },
    ])

    expect(report.results[0].performance).toMatchObject({ impressions: 400 })
    expect(report.results[0].findings.map((f) => f.id)).toContain("low-ctr")
  })
})

describe("performance findings", () => {
  it("flags no-impressions and low-ctr from performance", () => {
    expect(
      auditSeoDocumentFields({ status: "published" }, {
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
      }).map((f) => f.id)
    ).toContain("no-impressions")

    expect(
      auditSeoDocumentFields({ status: "published" }, {
        clicks: 1,
        impressions: 200,
        ctr: 0.005,
        position: 12,
      }).map((f) => f.id)
    ).toContain("low-ctr")
  })
})
