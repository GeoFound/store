import { parseBoolean } from "../../platform/analytics"
import { STORE_GRAPH_PRODUCT_ID } from "./graph-exporter"

export const STORE_GRAPH_MANIFEST_ID =
  "store-digital-goods-source-mapping-v1"

export type GraphDryRunConfig = {
  enabled: boolean
  endpoint: string
  tenantId: string
  productId: string
  manifestId: string
  defaultCountry: string
  defaultLanguage: string
  defaultChannel: string
  defaultPlatform: string
  productionWriteEnabled: false
  humanGateApproved: false
}

export function isGraphDryRunEnabled(
  env: Record<string, string | undefined> = process.env
) {
  const enabled = parseBoolean(env.GRAPH_DRY_RUN_ENABLED, false)

  return enabled && Boolean(env.GRAPH_DRY_RUN_ENDPOINT?.trim())
}

export function getGraphDryRunConfig(
  env: Record<string, string | undefined> = process.env
): GraphDryRunConfig {
  return {
    enabled: isGraphDryRunEnabled(env),
    endpoint: env.GRAPH_DRY_RUN_ENDPOINT?.trim() || "",
    tenantId: env.GRAPH_DRY_RUN_TENANT_ID?.trim() || "tenant-store-local",
    productId: STORE_GRAPH_PRODUCT_ID,
    manifestId:
      env.GRAPH_DRY_RUN_MANIFEST_ID?.trim() || STORE_GRAPH_MANIFEST_ID,
    defaultCountry: env.GRAPH_DRY_RUN_DEFAULT_COUNTRY?.trim() || "ZZ",
    defaultLanguage: env.GRAPH_DRY_RUN_DEFAULT_LANGUAGE?.trim() || "und",
    defaultChannel: env.GRAPH_DRY_RUN_DEFAULT_CHANNEL?.trim() || "backend",
    defaultPlatform: env.GRAPH_DRY_RUN_DEFAULT_PLATFORM?.trim() || "web",
    productionWriteEnabled: false,
    humanGateApproved: false,
  }
}
