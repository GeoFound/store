import {
  createStorefrontContentApplication,
  type StorefrontContentRepository,
} from "../application/content"
import type { ContentSeoEntityType } from "../modules/content-core/types"
import type { BackendRuntimeContext } from "../platform/backend-context"
import { resolveContentCoreService } from "./services"

export function resolveStorefrontContentApplication(scope: BackendRuntimeContext) {
  const content = resolveContentCoreService(scope)
  const repository: StorefrontContentRepository = {
    listPublishedEntries(input) {
      return content.listPublishedEntriesWithAssetsSafe(input)
    },
    retrievePublishedEntryBySlug(input) {
      return content.retrievePublishedEntryBySlugWithAssetsSafe(input)
    },
    retrieveSeoDocument(input) {
      return content.retrieveContentSeoDocumentSafe({
        entityType: input.entityType as ContentSeoEntityType,
        entityId: input.entityId,
        siteId: input.siteId,
        language: input.language,
      })
    },
  }

  return createStorefrontContentApplication(repository)
}
