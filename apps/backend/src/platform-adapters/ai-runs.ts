import type { BackendRuntimeContext } from "../platform/backend-context"
import { isPlatformPluginEnabled } from "../platform/runtime"
import type { AITaskRunSafe } from "../modules/ai-core/types"
import { resolveContentCoreService } from "./services"

/**
 * Cross-module composition: AI task runs are persisted by content-core
 * (`ContentAITaskRun`), but the AI control panel renders them through the
 * stateless ai-core dashboard shape. This adapter is the single bridge that
 * maps persisted content runs into `AITaskRunSafe`, so ai-core never has to
 * own run storage and content-core never has to know about the dashboard.
 */
export async function listAITaskRunsForDashboard(
  scope: BackendRuntimeContext,
  input?: { siteId?: string | null; limit?: number }
): Promise<AITaskRunSafe[]> {
  if (!isPlatformPluginEnabled("content-core")) {
    return []
  }

  const content = resolveContentCoreService(scope)
  const runs = await content.listContentAITaskRuns(
    {
      ...(input?.siteId ? { site_id: input.siteId } : {}),
    },
    {
      take: normalizeLimit(input?.limit, 50),
      order: {
        created_at: "DESC",
      },
    }
  )

  return runs.map(toAITaskRunSafe)
}

function toAITaskRunSafe(run: Record<string, unknown>): AITaskRunSafe {
  const taskType = String(run.task_type || "custom")

  return {
    id: String(run.id || ""),
    task_type: taskType,
    plugin_code: `content.${taskType}`,
    provider_code: nullableText(run.provider_code),
    site_id: nullableText(run.site_id),
    status: normalizeStatus(run.status),
    input_summary: nullableText(run.input_summary),
    output_summary: nullableText(run.output_summary),
    source_refs: toRecordArray(run.source_refs_json),
    artifact_refs: toRecordArray(run.artifact_refs_json),
    error_message: nullableText(run.error_message),
    created_at: toIso(run.created_at),
    updated_at: toIso(run.updated_at),
  }
}

function normalizeStatus(value: unknown): AITaskRunSafe["status"] {
  const allowed: AITaskRunSafe["status"][] = [
    "queued",
    "running",
    "succeeded",
    "failed",
    "canceled",
    "requires_review",
  ]

  return allowed.includes(value as AITaskRunSafe["status"])
    ? (value as AITaskRunSafe["status"])
    : "queued"
}

function toRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(
    (entry): entry is Record<string, unknown> =>
      Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
  )
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function toIso(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : null
  }

  if (typeof value === "string" && value.trim()) {
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date.toISOString() : null
  }

  return null
}

function normalizeLimit(value: unknown, fallback: number) {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value || ""), 10)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback
  }

  return Math.min(Math.floor(parsed), 200)
}
