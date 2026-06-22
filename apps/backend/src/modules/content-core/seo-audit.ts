import { normalizeSeoEntityType, normalizeSiteId } from "./service-helpers"
import type { ContentSeoDocumentListInput } from "./types"

/**
 * Deterministic SEO/AEO/GEO completeness + quality audit over canonical
 * content_seo_document records. Rule-based and side-effect free so it is fully
 * testable without external data; Google Search Console performance signals
 * layer on as a follow-up to reprioritize findings. See
 * docs/seo-aeo-geo-architecture.md (Phase 3).
 */

export type SeoAuditSeverity = "critical" | "warning" | "info"

export type SeoAuditFinding = {
  id: string
  severity: SeoAuditSeverity
  field: string
  message: string
}

export type SeoAuditResult = {
  id: string
  entity_type: string
  entity_id: string
  site_id: string
  language: string
  status: string
  score: number
  findings: SeoAuditFinding[]
}

const SEVERITY_PENALTY: Record<SeoAuditSeverity, number> = {
  critical: 25,
  warning: 10,
  info: 3,
}

const META_TITLE_MIN = 15
const META_TITLE_MAX = 65
const META_DESCRIPTION_MIN = 50
const META_DESCRIPTION_MAX = 165

export function auditSeoDocumentFields(
  doc: Record<string, unknown>
): SeoAuditFinding[] {
  const findings: SeoAuditFinding[] = []
  const metaTitle = text(doc.meta_title)
  const metaDescription = text(doc.meta_description)

  if (!metaTitle) {
    findings.push(finding("meta-title-missing", "critical", "meta_title", "Meta title is missing."))
  } else if (metaTitle.length < META_TITLE_MIN || metaTitle.length > META_TITLE_MAX) {
    findings.push(
      finding(
        "meta-title-length",
        "warning",
        "meta_title",
        `Meta title should be ${META_TITLE_MIN}-${META_TITLE_MAX} characters (currently ${metaTitle.length}).`
      )
    )
  }

  if (!metaDescription) {
    findings.push(
      finding("meta-description-missing", "critical", "meta_description", "Meta description is missing.")
    )
  } else if (
    metaDescription.length < META_DESCRIPTION_MIN ||
    metaDescription.length > META_DESCRIPTION_MAX
  ) {
    findings.push(
      finding(
        "meta-description-length",
        "warning",
        "meta_description",
        `Meta description should be ${META_DESCRIPTION_MIN}-${META_DESCRIPTION_MAX} characters (currently ${metaDescription.length}).`
      )
    )
  }

  if (!hasSchema(doc)) {
    findings.push(
      finding("structured-data-missing", "warning", "schema_json", "No structured-data hint (schema_type/schema_json).")
    )
  }

  if (!text(doc.canonical_url)) {
    findings.push(finding("canonical-missing", "info", "canonical_url", "No explicit canonical URL."))
  }

  if (!text(doc.og_image_url)) {
    findings.push(finding("og-image-missing", "info", "og_image_url", "No social/OG image."))
  }

  if (!nonEmptyArray(doc.faq_json)) {
    findings.push(finding("faq-missing", "info", "faq_json", "No FAQ — an answer-engine (AEO) opportunity."))
  }

  if (!text(doc.summary_tldr) && !nonEmptyArray(doc.key_facts_json)) {
    findings.push(
      finding(
        "quotability-missing",
        "info",
        "summary_tldr",
        "No TL;DR or key facts — generative engines (GEO) have nothing quotable."
      )
    )
  }

  if (text(doc.status) !== "published") {
    findings.push(finding("not-published", "info", "status", "Document is not published yet."))
  }

  return findings
}

export function scoreSeoFindings(findings: SeoAuditFinding[]): number {
  const penalty = findings.reduce(
    (total, item) => total + (SEVERITY_PENALTY[item.severity] || 0),
    0
  )
  return Math.max(0, 100 - penalty)
}

export type SeoAuditRepo = {
  listContentSeoDocuments(
    filter: Record<string, unknown>,
    config?: Record<string, unknown>
  ): Promise<Array<Record<string, unknown>>>
}

export type SeoAuditReport = {
  summary: {
    documents: number
    critical: number
    warning: number
    info: number
    average_score: number
  }
  results: SeoAuditResult[]
}

export async function auditContentSeo(
  repo: SeoAuditRepo,
  input?: ContentSeoDocumentListInput
): Promise<SeoAuditReport> {
  const docs = await repo.listContentSeoDocuments(
    {
      ...(input?.entityType
        ? { entity_type: normalizeSeoEntityType(input.entityType, "page") }
        : {}),
      ...(input?.siteId ? { site_id: normalizeSiteId(input.siteId) } : {}),
    },
    {
      take: clampLimit(input?.limit),
      order: { updated_at: "DESC" },
    }
  )

  const results = docs.map(toAuditResult)
  const counts = { critical: 0, warning: 0, info: 0 }
  for (const result of results) {
    for (const item of result.findings) {
      counts[item.severity] += 1
    }
  }

  return {
    summary: {
      documents: results.length,
      critical: counts.critical,
      warning: counts.warning,
      info: counts.info,
      average_score: results.length
        ? Math.round(
            results.reduce((total, result) => total + result.score, 0) /
              results.length
          )
        : 100,
    },
    results,
  }
}

function toAuditResult(doc: Record<string, unknown>): SeoAuditResult {
  const findings = auditSeoDocumentFields(doc)
  return {
    id: String(doc.id || ""),
    entity_type: String(doc.entity_type || ""),
    entity_id: String(doc.entity_id || ""),
    site_id: String(doc.site_id || ""),
    language: String(doc.language || ""),
    status: String(doc.status || ""),
    score: scoreSeoFindings(findings),
    findings,
  }
}

function finding(
  id: string,
  severity: SeoAuditSeverity,
  field: string,
  message: string
): SeoAuditFinding {
  return { id, severity, field, message }
}

function hasSchema(doc: Record<string, unknown>): boolean {
  if (text(doc.schema_type)) {
    return true
  }
  const schema = doc.schema_json
  return Boolean(schema) && typeof schema === "object"
}

function nonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function clampLimit(value: unknown): number {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value || ""), 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 200
  }
  return Math.min(Math.floor(parsed), 500)
}
