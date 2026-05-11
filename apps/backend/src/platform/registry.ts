import type {
  PlatformCapabilityName,
  PlatformResolutionContext,
  PluginManifest,
  PluginRegistration,
  VersionedPluginContract,
} from "./contracts"
import { PLATFORM_CAPABILITY_VERSIONS as SUPPORTED_CONTRACT_VERSIONS } from "./contracts"

type RegisteredPlugin = {
  manifest: PluginManifest
  enabled: boolean
}

export type PlatformRegistrySnapshot = {
  plugins: PluginRegistration<unknown>[]
  pluginOverrides: Array<{
    pluginId: string
    enabled: boolean
  }>
  contractOverrides: Array<{
    capability: PlatformCapabilityName
    name: string
    enabled: boolean
  }>
}

export class PlatformRegistry {
  private plugins = new Map<string, RegisteredPlugin>()
  private contracts = new Map<
    PlatformCapabilityName,
    Map<string, VersionedPluginContract<unknown>>
  >()
  private pluginOverrides = new Map<string, boolean>()
  private contractOverrides = new Map<
    PlatformCapabilityName,
    Map<string, boolean>
  >()

  registerPlugin<T>(registration: PluginRegistration<T>) {
    this.validatePluginRegistration(registration)

    const enabled =
      this.pluginOverrides.get(registration.manifest.id) ??
      registration.enabled ??
      registration.manifest.enabledByDefault ??
      true

    this.plugins.set(registration.manifest.id, {
      manifest: registration.manifest,
      enabled,
    })

    for (const contract of registration.contracts || []) {
      this.registerContract(contract, registration.manifest.id)
    }
  }

  registerContract<T>(
    contract: VersionedPluginContract<T>,
    pluginId = contract.pluginId
  ) {
    this.validateContract(contract, pluginId)

    const contracts = this.contracts.get(contract.capability) ?? new Map()
    contracts.set(contract.name, {
      ...contract,
      enabled: this.getContractOverride(contract.capability, contract.name) ??
        contract.enabled,
      implementation: contract.implementation,
    })
    this.contracts.set(contract.capability, contracts)

    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      this.plugins.set(pluginId, {
        manifest: {
          id: pluginId,
          version: contract.version,
          capabilities: [contract.capability],
        },
        enabled: this.pluginOverrides.get(pluginId) ?? contract.enabled ?? true,
      })
    }
  }

  listPlugins() {
    return Array.from(this.plugins.values()).map((plugin) => ({
      ...plugin.manifest,
      enabled: plugin.enabled,
    }))
  }

  isPluginEnabled(pluginId: string) {
    return this.pluginOverrides.get(pluginId) ?? this.plugins.get(pluginId)?.enabled ?? true
  }

  listContracts(capability: PlatformCapabilityName) {
    return Array.from(this.contracts.get(capability)?.values() || [])
  }

  setPluginEnabled(pluginId: string, enabled: boolean) {
    this.pluginOverrides.set(pluginId, enabled)

    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      return false
    }

    this.plugins.set(pluginId, {
      ...plugin,
      enabled,
    })

    return true
  }

  setContractEnabled(
    capability: PlatformCapabilityName,
    name: string,
    enabled: boolean
  ) {
    const overrides = this.contractOverrides.get(capability) ?? new Map()
    overrides.set(name, enabled)
    this.contractOverrides.set(capability, overrides)

    const contract = this.contracts.get(capability)?.get(name)
    if (!contract) {
      return false
    }

    this.contracts.get(capability)?.set(name, {
      ...contract,
      enabled,
    })

    return true
  }

  removePlugin(pluginId: string) {
    const pluginExisted = this.plugins.delete(pluginId)

    for (const [capability, contracts] of this.contracts.entries()) {
      for (const [name, contract] of contracts.entries()) {
        if (contract.pluginId === pluginId) {
          contracts.delete(name)
        }
      }

      if (!contracts.size) {
        this.contracts.delete(capability)
      }
    }

    return pluginExisted
  }

  replacePlugin<T>(registration: PluginRegistration<T>) {
    const snapshot = this.snapshot()
    this.removePlugin(registration.manifest.id)

    try {
      this.registerPlugin(registration)
    } catch (error) {
      this.restore(snapshot)
      throw error
    }
  }

  snapshot(): PlatformRegistrySnapshot {
    return {
      plugins: this.listPlugins().map((plugin) => ({
        manifest: this.copyManifest(plugin),
        enabled: plugin.enabled,
        contracts: this.listContractsForPlugin(plugin.id).map((contract) => ({
          ...contract,
        })),
      })),
      pluginOverrides: Array.from(this.pluginOverrides.entries()).map(
        ([pluginId, enabled]) => ({
          pluginId,
          enabled,
        })
      ),
      contractOverrides: Array.from(this.contractOverrides.entries()).flatMap(
        ([capability, contracts]) =>
          Array.from(contracts.entries()).map(([name, enabled]) => ({
            capability,
            name,
            enabled,
          }))
      ),
    }
  }

  restore(snapshot: PlatformRegistrySnapshot) {
    this.plugins.clear()
    this.contracts.clear()
    this.pluginOverrides.clear()
    this.contractOverrides.clear()

    for (const override of snapshot.pluginOverrides) {
      this.pluginOverrides.set(override.pluginId, override.enabled)
    }

    for (const override of snapshot.contractOverrides) {
      const contracts = this.contractOverrides.get(override.capability) ?? new Map()
      contracts.set(override.name, override.enabled)
      this.contractOverrides.set(override.capability, contracts)
    }

    for (const registration of snapshot.plugins) {
      this.registerPlugin({
        manifest: this.copyManifest(registration.manifest),
        enabled: registration.enabled,
        contracts: (registration.contracts || []).map((contract) => ({
          ...contract,
        })),
      })
    }
  }

  resolveContract<T>(
    capability: PlatformCapabilityName,
    name?: string,
    context?: PlatformResolutionContext
  ) {
    const candidates = this.listContracts(capability).filter((contract) => {
      if (contract.enabled === false) {
        return false
      }

      const plugin = this.plugins.get(contract.pluginId)
      if (plugin && !plugin.enabled) {
        return false
      }

      return this.matchesScope(contract, context)
    })

    if (!candidates.length) {
      return undefined
    }

    if (name) {
      return candidates.find((candidate) => candidate.name === name)
        ?.implementation as T | undefined
    }

    return [...candidates]
      .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))[0]
      ?.implementation as T | undefined
  }

  resolveContractOrFallback<T>(
    capability: PlatformCapabilityName,
    name: string,
    fallbackName?: string,
    context?: PlatformResolutionContext
  ) {
    return (
      this.resolveContract<T>(capability, name, context) ??
      (fallbackName
        ? this.resolveContract<T>(capability, fallbackName, context)
      : undefined)
    )
  }

  private matchesScope(
    contract: VersionedPluginContract<unknown>,
    context?: PlatformResolutionContext
  ) {
    if (!context || !contract.scope) {
      return true
    }

    if (
      contract.scope.siteIds?.length &&
      (!context.siteId || !contract.scope.siteIds.includes(context.siteId))
    ) {
      return false
    }

    if (
      contract.scope.productTypeCodes?.length &&
      (!context.productTypeCode ||
        !contract.scope.productTypeCodes.includes(context.productTypeCode))
    ) {
      return false
    }

    if (
      contract.scope.channelCodes?.length &&
      (!context.channelCode ||
        !contract.scope.channelCodes.includes(context.channelCode))
    ) {
      return false
    }

    return true
  }

  private listContractsForPlugin(pluginId: string) {
    return Array.from(this.contracts.values())
      .flatMap((contracts) => Array.from(contracts.values()))
      .filter((contract) => contract.pluginId === pluginId)
  }

  private getContractOverride(
    capability: PlatformCapabilityName,
    name: string
  ) {
    return this.contractOverrides.get(capability)?.get(name)
  }

  private validatePluginRegistration<T>(registration: PluginRegistration<T>) {
    const manifestId = registration.manifest.id?.trim()

    if (!manifestId) {
      throw new Error("Plugin manifest id is required")
    }

    for (const dependency of registration.manifest.dependencies || []) {
      const installed = this.plugins.get(dependency.id)

      if (!installed) {
        if (dependency.optional) {
          continue
        }

        throw new Error(
          `Plugin "${registration.manifest.id}" requires dependency "${dependency.id}"`
        )
      }

      if (
        dependency.version &&
        !matchesDependencyVersion(installed.manifest.version, dependency.version)
      ) {
        throw new Error(
          `Plugin "${registration.manifest.id}" requires "${dependency.id}" version "${dependency.version}" but found "${installed.manifest.version}"`
        )
      }
    }

    for (const contract of registration.contracts || []) {
      this.validateContract(
        contract,
        registration.manifest.id,
        registration.manifest.capabilities
      )
    }
  }

  private validateContract(
    contract: VersionedPluginContract<unknown>,
    pluginId: string,
    declaredCapabilities?: PlatformCapabilityName[]
  ) {
    const plugin = this.plugins.get(pluginId)
    const allowedCapabilities =
      declaredCapabilities ||
      plugin?.manifest.capabilities ||
      (contract.pluginId === pluginId ? [contract.capability] : [])

    if (!allowedCapabilities.includes(contract.capability)) {
      throw new Error(
        `Plugin "${pluginId}" cannot register undeclared capability "${contract.capability}"`
      )
    }

    const supportedVersions = SUPPORTED_CONTRACT_VERSIONS[contract.capability]

    if (!supportedVersions.includes(contract.version)) {
      throw new Error(
        `Contract "${contract.name}" for capability "${contract.capability}" uses unsupported version "${contract.version}"`
      )
    }
  }

  private copyManifest(manifest: PluginManifest): PluginManifest {
    return {
      ...manifest,
      capabilities: [...manifest.capabilities],
      dependencies: manifest.dependencies?.map((dependency) => ({
        ...dependency,
      })),
    }
  }
}

export function createPlatformRegistry() {
  return new PlatformRegistry()
}

function matchesDependencyVersion(actual: string, expected: string) {
  if (actual === expected) {
    return true
  }

  const actualMajor = extractMajor(actual)
  const expectedMajor = extractMajor(expected)

  if (actualMajor && expectedMajor) {
    return actualMajor === expectedMajor
  }

  return false
}

function extractMajor(version: string) {
  const normalized = version.replace(/^v/i, "")
  const [major] = normalized.split(".")

  return major || null
}
