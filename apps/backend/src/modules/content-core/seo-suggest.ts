import type { AIMessage } from "../../platform/ai"
import { auditSeoDocumentFields, type SeoAuditFinding } from "./seo-audit"
import {
  normalizeSeoEntityType,
  normalizeSeoLanguage,
  normalizeSiteId,
  requireText,
} from "./service-helpers"

/**
 * AI suggestion layer over the deterministic SEO audit (content.seo_audit). It
 * turns audit findings + the current document into review-gated improvement
 * suggestions via the AI runtime, persists the run, and returns suggestions for
 * a human to apply through the upsert form. No content is auto-published.
 * See docs/seo-aeo-geo-architecture.md (Phase 3).
 */

const AI_CORE_SERVICE_KEY = "aiCore"

type AiInvoker = {
  invokeForCapabilitySafe(input: {
    capability: string
    providerCode?: string | null
    siteId?: string | null
    model?: string | null
    messages?: AIMessage[]
    metadata?: Record<string, unknown> | null
  }): Promise<{
    provider_code: string
    provider_protocol: string
    capability: string
    model: string | null
    output_text: string | null
    output: Record<string, unknown> | null
    usage: Record<string, unknown> | null
  }>
}

type SuggestScope = { resolve(key: string): unknown }

export type SeoSuggestRepo = {
  retrieveContentSeoDocumentSafe(input: {
    entityType: string
    entityId: string
    siteId?: string | null
    language?: string | null
  }): Promise<Record<string, unknown> | null>
  createAITaskRunSafe(input: Record<string, unknown>): Promise<{ id: unknown }>
}

export type SeoSuggestInput = {
  scope: SuggestScope
  entityType: string
  entityId: string
  siteId?: string | null
  language?: string | null
  providerCode?: string | null
  model?: string | null
}

export type SeoSuggestResult = {
  configured: boolean
  findings: SeoAuditFinding[]
  suggestion: { text: string | null; output: Record<string, unknown> | null } | null
  run_id: string | null
  error?: string
}

export function buildSeoSuggestionMessages(
  doc: Record<string, unknown>,
  findings: SeoAuditFinding[]
): AIMessage[] {
  const current = [
    field("Meta title", doc.meta_title),
    field("Meta description", doc.meta_description),
    field("Summary / TL;DR", doc.summary_tldr),
    field("Canonical URL", doc.canonical_url),
    field("Schema type", doc.schema_type),
  ]
    .filter(Boolean)
    .join("\n")

  const findingsList = findings.length
    ? findings.map((item) => `- [${item.severity}] ${item.field}: ${item.message}`).join("\n")
    : "- No deterministic findings; suggest improvements for answer/generative engines."

  return [
    {
      role: "system",
      content:
        "You are an SEO/AEO/GEO specialist. Improve a page's discoverability document so it addresses the audit findings. Return STRICT JSON with keys: meta_title, meta_description, summary_tldr, key_facts (array of strings), and faq (array of {question, answer}). Keep meta_title 30-60 chars and meta_description 70-160 chars. Do not invent facts.",
    },
    {
      role: "user",
      content: `Current document:\n${current || "(empty)"}\n\nAudit findings:\n${findingsList}\n\nReturn only the JSON object.`,
    },
  ]
}

export async function suggestSeoFixes(
  repo: SeoSuggestRepo,
  input: SeoSuggestInput
): Promise<SeoSuggestResult> {
  const entityType = normalizeSeoEntityType(input.entityType, "page")
  const entityId = requireText(input.entityId, "seo entity id")
  const siteId = normalizeSiteId(input.siteId)
  const language = normalizeSeoLanguage(input.language)

  const doc =
    (await repo.retrieveContentSeoDocumentSafe({
      entityType,
      entityId,
      siteId,
      language,
    })) || {}
  const findings = auditSeoDocumentFields(doc)

  const aiCore = input.scope?.resolve(AI_CORE_SERVICE_KEY) as AiInvoker | undefined
  if (!aiCore) {
    return { configured: false, findings, suggestion: null, run_id: null }
  }

  let result: Awaited<ReturnType<AiInvoker["invokeForCapabilitySafe"]>>
  try {
    result = await aiCore.invokeForCapabilitySafe({
      capability: "text.generate",
      providerCode: input.providerCode,
      siteId,
      model: input.model,
      messages: buildSeoSuggestionMessages(doc, findings),
      metadata: { task: "content.seo_audit", entity_type: entityType, entity_id: entityId },
    })
  } catch (error) {
    return {
      configured: true,
      findings,
      suggestion: null,
      run_id: null,
      error: error instanceof Error ? error.message : "AI suggestion failed",
    }
  }

  const run = await repo.createAITaskRunSafe({
    siteId,
    taskType: "custom",
    providerCode: result.provider_code,
    providerProtocol: result.provider_protocol,
    providerCapability: result.capability,
    model: result.model,
    status: "requires_review",
    inputSummary: `SEO audit suggestion for ${entityType}:${entityId}`,
    output: { text: result.output_text, suggestion: result.output, usage: result.usage },
    metadata: { task: "content.seo_audit", findings },
  })

  return {
    configured: true,
    findings,
    suggestion: { text: result.output_text, output: result.output },
    run_id: String(run.id),
  }
}

function field(label: string, value: unknown): string {
  return typeof value === "string" && value.trim() ? `${label}: ${value.trim()}` : ""
}
