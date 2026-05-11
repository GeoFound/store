export const PLATFORM_CAPABILITIES = [
  "payment-provider",
  "inventory-handler",
  "delivery-handler",
  "order-access-provider",
  "product-policy",
  "storefront-slot",
  "admin-extension",
  "background-job",
  "hook-subscriber",
  "theme-slot",
] as const

export type PlatformCapabilityName = (typeof PLATFORM_CAPABILITIES)[number]

export type PlatformContractVersion = string

export const PLATFORM_CAPABILITY_VERSIONS: Record<
  PlatformCapabilityName,
  PlatformContractVersion[]
> = {
  "payment-provider": ["v1"],
  "inventory-handler": ["v1"],
  "delivery-handler": ["v1"],
  "order-access-provider": ["v1"],
  "product-policy": ["v1"],
  "storefront-slot": ["v1"],
  "admin-extension": ["v1"],
  "background-job": ["v1"],
  "hook-subscriber": ["v1"],
  "theme-slot": ["v1"],
}

export type PlatformScope = {
  siteIds?: string[]
  productTypeCodes?: string[]
  channelCodes?: string[]
}

export type PluginDependency = {
  id: string
  version?: string
  optional?: boolean
}

export type PluginManifest = {
  id: string
  version: string
  capabilities: PlatformCapabilityName[]
  dependencies?: PluginDependency[]
  enabledByDefault?: boolean
  migrationsOwner?: string
  title?: string
  description?: string
}

export type VersionedPluginContract<T = unknown> = {
  capability: PlatformCapabilityName
  name: string
  version: PlatformContractVersion
  pluginId: string
  implementation: T
  priority?: number
  enabled?: boolean
  scope?: PlatformScope
  description?: string
}

export type PluginRegistration<T = unknown> = {
  manifest: PluginManifest
  contracts?: VersionedPluginContract<T>[]
  enabled?: boolean
}

export type PlatformResolutionContext = {
  siteId?: string
  productTypeCode?: string
  channelCode?: string
}
