# SEO / AEO / GEO Architecture

Status: **approved foundation** (2026-06-21). Owner: `content-core` (data + generation),
storefront (serving), `analytics-core` (feedback loop), `ops-control` (production gate).

This document is the long-lived plan for discoverability across **all sites**. It is a
spec, not a finished implementation — Phases 0–3 below track delivery.

---

## 1. Decisions (locked)

- **Platform capability, not a site feature.** Implemented once and inherited by every
  site. It is **not** per-site code and **not** visitor personalization. Each site gets the
  same capability with its own configuration, scoped by `site_id × language`.
- **Optional, default on.** Toggled with a standard enable flag (`SEO_ENABLED`, mirroring
  `AI_ENABLED` / `ANALYTICS_ENABLED`), plus a per-site `enabled` field and the platform
  contract enable/disable controls.
- **AI crawlers allowed by default** (`GPTBot`, `ClaudeBot`, `PerplexityBot`,
  `Google-Extended`), exposed as a per-site toggle.
- **Multi-language is first-class.** All discoverability data is keyed by
  `site_id × language`; this drives `hreflang`, sitemap alternates, and per-language
  canonical documents.
- **No new module, no plugin.** Extend `content-core` (one table + AI output contract) and
  build the serving layer in the storefront.
- **No external SaaS in the backend.** Semrush / Ahrefs / Similarweb are operator research
  tools, not infrastructure. The only programmatic external source worth integrating is
  Google Search Console (Phase 3).

---

## 2. Mental model: one canonical document, many serializers

```
[data]      canonical "discoverability document"  (consumer-agnostic)
              keyed by entity_type × entity_id × site_id × language
                 │
[generation]  AI tasks emit the document together with the content (one human review)
                 │
[serving]     pure serializers translate the document into each output format
                 ├─ toHtmlMetadata()  → Next Metadata (title/description/canonical/OG)
                 ├─ toJsonLd()        → schema.org (Product/Article/FAQ/Breadcrumb/Org)
                 ├─ toSitemapEntry()  → sitemap.xml (+ hreflang alternates)
                 ├─ toLlmsTxt()       → llms.txt / llms-full.txt (GEO)
                 └─ toOgImage()       → share / citation image
                 │
[feedback]    GSC + GA4 → content.seo_audit task → prioritized backlog → back to generation
```

**Why this is durable:** a new format or AI engine = **one new serializer** (or one schema
type, or one AI sub-task). The data and generation layers do not change. This mirrors the
platform's existing contract/adapter pattern.

SEO, AEO, and GEO are ~80% the same foundation (crawlable + structured + authoritative).
The deltas are: richer schema.org, an `llms.txt`, and content written to be **quotable**
(TL;DR, FAQ, key facts, clear entities).

---

## 3. Data layer (in `content-core`)

A single uniform table covers any indexable entity. New table, **not** a new module.

```
content_seo_document
  id
  entity_type      product | content_entry | collection | page | site
  entity_id        text          # for product = Medusa product_id (linked, not forked)
  site_id          text
  language         text          # drives hreflang
  -- SEO base
  meta_title, meta_description, canonical_url, slug
  robots           json          # { index, follow, max_image_preview, ... }
  og_title, og_description, og_image_asset_id
  keywords_json    json
  -- structured data (SEO + AEO + GEO)
  schema_type      text          # Product | Article | FAQPage | ...
  schema_json      json          # extra/override fields for the serializer
  -- AEO / GEO ("quotability")
  summary_tldr     text
  faq_json         json          # [{ q, a }] → FAQPage + answer engines
  key_facts_json   json          # citable statements for generative engines
  entities_json    json          # named entities (entity clarity)
  answer_target    text          # the core question this page answers
  -- governance
  status, review_status          # reuse existing content review machinery
  source           ai | human | mixed
  version          int
  schema_version   int           # version of THIS document shape (for safe evolution)
  updated_at
  unique (entity_type, entity_id, site_id, language)
```

Migration path: keep `content_entry.seo_json` as the transitional store, then converge
onto this table so all entities share one serializer path.

---

## 4. Generation layer (AI) — the critical coupling

Discoverability fields are part of the **AI output contract**, not a bolt-on. Content is
born SEO/AEO/GEO-ready and one human review covers body + metadata.

- `content.article_draft` / `content.article_rewrite` also emit
  `meta_title / meta_description / slug / summary_tldr / faq[] / key_facts[] / entities[] / schema_type`.
- `content.seo` — fill/repair SEO documents for existing content.
- `content.faq` (new) — extract Q&A → feeds AEO and `FAQPage`.
- `content.seo_audit` (new, Phase 3) — diff GSC reality against the canonical document,
  emit a fix backlog.
- All run through the existing AI task executor and stay in `requires_review`.

---

## 5. Serving layer (storefront) — `lib/seo/`

Each serializer is a **pure function** of the canonical document.

| Phase | Output | Notes |
|-------|--------|-------|
| 0 | per-route `generateMetadata` (PDP, insights, collection) | title/description/canonical/OG/Twitter |
| 0 | document透传 to `/store/content` + storefront types | currently missing |
| 0 | `app/sitemap.ts` + `app/robots.ts` | dynamic; multi-site → sitemap index + hreflang; AI-crawler policy from config |
| 1 | `<JsonLd>` component | Product+Offer(+AggregateRating), Article, FAQPage, BreadcrumbList, Organization+WebSite(+SearchAction) |
| 2 | `app/llms.txt` + `llms-full.txt` route handler | GEO core |
| 2 | `opengraph-image.tsx` | share / citation image |
| 2 (opt) | RSS/Atom feed | distribution + some AI crawlers |

A `serializers` registry (`schema_type → JSON-LD builder`) keeps new types additive.

---

## 6. Feedback layer (Phase 3) — makes it compound

- **Google Search Console API → `analytics-core`** (free): per-URL queries, impressions,
  clicks, index state — the source of truth, not estimates.
- Reuse `analytics-ga4` for conversion.
- `content.seo_audit` diffs GSC vs. canonical documents → prioritized backlog (missing
  meta, low-CTR titles, missing FAQ, not indexed, no structured data) → human review →
  regenerate.

---

## 7. Admin control panel surfaces

Per `ADMIN_CONTROL_PANEL_POLICY` (registered 2026-06-21, v1.3.0). SEO triggers the
`multi-site-configuration`, `human-review`, `customer-or-order-impact`, `queue-or-retry`,
and `production-gate` admission criteria, so it **must** have a control-panel surface.

**In the control panel (per-site governance + observability):**

| Surface | Where |
|---------|-------|
| SEO/discoverability settings: master enable, indexability, AI-crawler policy, Organization structured-data identity, default OG, languages/hreflang, canonical domain, sitemap scope, llms.txt, GSC/Bing verification tokens | `/app/seo` (growth, owner content-core) |
| SEO health / audit (coverage, missing meta, noindex pages, structured-data errors, GSC summary) — read-only, Phase 3 | `/app/seo` or `/app/analytics` |
| AI SEO/FAQ draft review queue | `/app/ai` (intelligence) — existing AI review queue |
| Production "discoverability readiness" gate (sitemap/robots served, canonical set, not accidentally noindex) | registered as `discoverability-readiness` production surface, owner content-core |

**Not in the control panel:** per-entity meta/FAQ/schema for each product or article — edited
in the content/product editors (AI-assisted). The control panel governs policy and health,
not per-page authoring.

Registered policy entries (in `apps/backend/src/platform/admin-control-panel-policy.ts` and
mirrored in `.ai/admin-control-panel-policy.json`):
- `informationArchitecture.routePlacements` → `/app/seo` (growth, content-core).
- `requiredProductionSurfaces` → `discoverability-readiness` (gate + evidence
  `last_discoverability_readiness_ref`; config keys `SEO_ENABLED`, `SEO_INDEXING_ENABLED`,
  `SEO_AI_CRAWLERS_ALLOWED`, `SITE_CANONICAL_URL`, `SEO_LANGUAGES`).

---

## 8. Config keys (per deployment / per site)

| Key | Meaning |
|-----|---------|
| `SEO_ENABLED` | Master capability toggle (default on) |
| `SEO_INDEXING_ENABLED` | Allow indexing (staging → off ⇒ global noindex) |
| `SEO_AI_CRAWLERS_ALLOWED` | Allow GPTBot/ClaudeBot/PerplexityBot/Google-Extended |
| `SITE_CANONICAL_URL` | Canonical base URL / domain for the site |
| `SEO_LANGUAGES` | Enabled languages → hreflang + sitemap alternates |

---

## 9. Roadmap

- **Phase 0 — foundation (highest ROI):** canonical document透传 to the storefront;
  per-route `generateMetadata` (PDP, insights, collection); `sitemap.ts` + `robots.ts`.
- **Phase 1 — structured data:** `<JsonLd>` + schema.org per entity.
- **Phase 2 — AEO/GEO:** `llms.txt`, FAQ/TL;DR/key_facts generation + rendering, OG images,
  AI-crawler policy enforcement.
- **Phase 3 — feedback loop:** GSC API into `analytics-core` + `content.seo_audit` +
  auto backlog.
- **Ongoing:** every new engine/format = one serializer or one AI sub-task; the data layer
  does not move.

---

## 10. Explicitly out of scope

- No standalone SEO module or plugin.
- No Semrush/Ahrefs/Similarweb backend integration.
- No per-visitor personalized metadata (breaks caching and indexing).
- No business logic in the serving layer — serializers stay pure.
