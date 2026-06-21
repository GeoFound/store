import { describe, expect, it } from "vitest"
import type { ContentEntry } from "@/lib/types"
import { resolveContentSeo } from "@/lib/content-seo"
import { faqPageJsonLd } from "@/lib/structured-data"

function entryWithSeo(seo: Record<string, unknown> | null): ContentEntry {
  return { slug: "x", title: "T", seo_json: seo } as unknown as ContentEntry
}

describe("resolveContentSeo", () => {
  it("extracts overrides across key aliases", () => {
    const seo = resolveContentSeo(
      entryWithSeo({
        meta_title: "Override title",
        description: "Override description",
        canonical: "https://shop.example.com/insights/x",
        og_image: "https://cdn.example.com/x.png",
        key_facts: ["fact a", " fact b "],
        faq: [
          { question: "Q1?", answer: "A1" },
          { q: "Q2?", a: "A2" },
          { question: "incomplete" },
        ],
      })
    )

    expect(seo.metaTitle).toBe("Override title")
    expect(seo.metaDescription).toBe("Override description")
    expect(seo.canonicalUrl).toBe("https://shop.example.com/insights/x")
    expect(seo.ogImage).toBe("https://cdn.example.com/x.png")
    expect(seo.keyFacts).toEqual(["fact a", "fact b"])
    expect(seo.faq).toEqual([
      { question: "Q1?", answer: "A1" },
      { question: "Q2?", answer: "A2" },
    ])
  })

  it("returns empty overrides when seo_json is missing", () => {
    expect(resolveContentSeo(entryWithSeo(null))).toEqual({
      metaTitle: null,
      metaDescription: null,
      canonicalUrl: null,
      ogImage: null,
      faq: [],
      keyFacts: [],
    })
  })
})

describe("faqPageJsonLd", () => {
  it("builds a FAQPage from Q&A", () => {
    expect(
      faqPageJsonLd([{ question: "Q?", answer: "A" }])
    ).toMatchObject({
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Q?",
          acceptedAnswer: { "@type": "Answer", text: "A" },
        },
      ],
    })
  })

  it("returns null when there are no questions", () => {
    expect(faqPageJsonLd([])).toBeNull()
  })
})
