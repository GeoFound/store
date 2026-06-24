import {
  createStorefrontMarketingApplication,
  type StorefrontMarketingRepository,
} from "../application/marketing"
import type { BackendRuntimeContext } from "../platform/backend-context"
import { resolveMarketingEngineService } from "./services"

export function resolveStorefrontMarketingApplication(
  scope: BackendRuntimeContext
) {
  const marketing = resolveMarketingEngineService(scope)
  const repository: StorefrontMarketingRepository = {
    listCampaigns(input) {
      return marketing.listCampaignsSafe(input)
    },
  }

  return createStorefrontMarketingApplication(repository)
}
