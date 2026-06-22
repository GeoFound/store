import type { BackendRuntimeContext } from "../platform/backend-context"
import {
  suggestSeoFixes,
  type SeoSuggestResult,
} from "../modules/content-core/seo-suggest"
import { resolveContentCoreService } from "./services"

/**
 * Cross-module composition for the AI SEO-suggestion endpoint: resolves the
 * content-core service and runs the audit-driven suggestion. API routes import
 * this adapter rather than reaching into module internals directly.
 */
export async function suggestSeoFixesForRequest(
  scope: BackendRuntimeContext,
  input: {
    entityType: string
    entityId: string
    siteId?: string | null
    language?: string | null
    providerCode?: string | null
    model?: string | null
  }
): Promise<SeoSuggestResult> {
  const content = resolveContentCoreService(scope)
  return suggestSeoFixes(content, { scope, ...input })
}
