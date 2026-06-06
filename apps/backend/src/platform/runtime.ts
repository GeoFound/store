import type {
  PlatformCapabilityName,
  PlatformResolutionContext,
  PluginRegistration,
} from "./contracts"
import { PLATFORM_CAPABILITIES } from "./contracts"
import {
  createPlatformHookRegistry,
  type PlatformHookRegistry,
  type PlatformHookName,
  type RegisteredHook,
} from "./hooks"
import {
  createPlatformRegistry,
  type PlatformRegistry,
} from "./registry"
import { registerDefaultPlatformCapabilities } from "./defaults"
import {
  ensurePlatformIntegrationsRegistered,
  resetPlatformIntegrationsForTests,
} from "./integrations"

export type PlatformRuntimeOptions = {
  includeDefaults?: boolean
  plugins?: PluginRegistration<unknown>[]
  enabledPlugins?: string[]
  disabledPlugins?: string[]
  enabledContracts?: Partial<Record<PlatformCapabilityName, string[]>>
  disabledContracts?: Partial<Record<PlatformCapabilityName, string[]>>
  resolutionContext?: PlatformResolutionContext
}

let runtimeRegistry: PlatformRegistry | null = null
let runtimeHooks: PlatformHookRegistry | null = null
let runtimeShouldRegisterDefaultIntegrations = true

export function createPlatformRuntime(options?: PlatformRuntimeOptions) {
  const registry =
    options?.includeDefaults === false
      ? createPlatformRegistry()
      : registerDefaultPlatformCapabilities(createPlatformRegistry())

  for (const pluginId of options?.disabledPlugins || []) {
    registry.setPluginEnabled(pluginId, false)
  }

  for (const pluginId of options?.enabledPlugins || []) {
    registry.setPluginEnabled(pluginId, true)
  }

  for (const [capability, names] of Object.entries(
    options?.disabledContracts || {}
  ) as Array<[PlatformCapabilityName, string[]]>) {
    for (const name of names) {
      registry.setContractEnabled(capability, name, false)
    }
  }

  for (const [capability, names] of Object.entries(
    options?.enabledContracts || {}
  ) as Array<[PlatformCapabilityName, string[]]>) {
    for (const name of names) {
      registry.setContractEnabled(capability, name, true)
    }
  }

  for (const plugin of options?.plugins || []) {
    registry.registerPlugin(plugin)
  }

  return registry
}

export function getPlatformRuntime() {
  if (!runtimeRegistry) {
    const options = parsePlatformRuntimeOptionsFromEnv()
    runtimeRegistry = createPlatformRuntime(options)
    runtimeShouldRegisterDefaultIntegrations = options.includeDefaults !== false
  }

  if (runtimeShouldRegisterDefaultIntegrations) {
    ensurePlatformIntegrationsRegistered()
  }

  return runtimeRegistry
}

export function configurePlatformRuntime(options?: PlatformRuntimeOptions) {
  runtimeRegistry = createPlatformRuntime(options)
  runtimeShouldRegisterDefaultIntegrations = options?.includeDefaults !== false

  if (runtimeShouldRegisterDefaultIntegrations) {
    ensurePlatformIntegrationsRegistered()
  }

  return runtimeRegistry
}

export function getPlatformHookRuntime() {
  if (!runtimeHooks) {
    runtimeHooks = createPlatformHookRegistry({
      isPluginEnabled: (pluginId) => getPlatformRuntime().isPluginEnabled(pluginId),
      isHookEnabled: (hookName) =>
        Boolean(
          getPlatformRuntime().resolveContract(
            "hook-subscriber",
            hookName
          )
        ),
    })
  }

  return runtimeHooks
}

export function registerPlatformHook<T>(hook: RegisteredHook<T>) {
  getPlatformRuntime().registerContract({
    capability: "hook-subscriber",
    name: hook.name,
    pluginId: hook.pluginId,
    version: "v1",
    enabled: hook.enabled,
    implementation: {
      hook: hook.hook,
      name: hook.name,
    },
    description: `Hook subscriber for ${hook.hook}`,
  }, hook.pluginId)

  getPlatformHookRuntime().registerHook(hook)
}

export async function emitPlatformHook<T>(
  hook: PlatformHookName,
  input: T
) {
  getPlatformRuntime()
  await getPlatformHookRuntime().emitHook(hook, input)
}

export function isPlatformPluginEnabled(pluginId: string) {
  return getPlatformRuntime().isPluginEnabled(pluginId)
}

export function installPlatformPlugin<T>(registration: PluginRegistration<T>) {
  getPlatformRuntime().registerPlugin(registration)
}

export function replacePlatformPlugin<T>(registration: PluginRegistration<T>) {
  getPlatformRuntime().replacePlugin(registration)
}

export function removePlatformPlugin(pluginId: string) {
  return getPlatformRuntime().removePlugin(pluginId)
}

export function snapshotPlatformRuntime() {
  return getPlatformRuntime().snapshot()
}

export function restorePlatformRuntime(
  snapshot: ReturnType<PlatformRegistry["snapshot"]>
) {
  getPlatformRuntime().restore(snapshot)
}

export function parsePlatformRuntimeOptionsFromEnv(
  env: Record<string, string | undefined> = process.env
): PlatformRuntimeOptions {
  return {
    enabledPlugins: mergeStringLists(
      splitCommaList(env.PLATFORM_ENABLED_PLUGINS),
      splitCommaList(env.NEXT_PUBLIC_PLATFORM_ENABLED_PLUGINS)
    ),
    disabledPlugins: mergeStringLists(
      splitCommaList(env.PLATFORM_DISABLED_PLUGINS),
      splitCommaList(env.NEXT_PUBLIC_PLATFORM_DISABLED_PLUGINS)
    ),
    enabledContracts: parseCapabilityContractMap(
      env.PLATFORM_ENABLED_CONTRACTS,
      "PLATFORM_ENABLED_CONTRACTS"
    ),
    disabledContracts: parseCapabilityContractMap(
      env.PLATFORM_DISABLED_CONTRACTS,
      "PLATFORM_DISABLED_CONTRACTS"
    ),
  }
}

export function resetPlatformRuntimeForTests() {
  runtimeRegistry = null
  runtimeHooks = null
  runtimeShouldRegisterDefaultIntegrations = true
  resetPlatformIntegrationsForTests()
}

function splitCommaList(value?: string) {
  return (value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function mergeStringLists(...values: string[][]) {
  const merged = values.flat().filter(Boolean)
  return merged.length ? Array.from(new Set(merged)) : undefined
}

function parseCapabilityContractMap(value?: string, envName = "platform contracts") {
  const entries = (value || "")
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)

  if (!entries.length) {
    return undefined
  }

  const result: Partial<Record<PlatformCapabilityName, string[]>> = {}

  for (const entry of entries) {
    const [rawCapability, names] = entry.split(":")
    const capability = rawCapability?.trim()
    const contractNames = splitCommaList(names)

    if (!capability) {
      throw new Error(`${envName} contains an empty capability entry`)
    }

    if (!isPlatformCapabilityName(capability)) {
      throw new Error(
        `${envName} contains unsupported capability "${capability}"`
      )
    }

    if (!contractNames.length) {
      throw new Error(
        `${envName} entry "${capability}" must include at least one contract name`
      )
    }

    result[capability] = mergeStringLists(
      result[capability] || [],
      contractNames
    )
  }

  return Object.keys(result).length ? result : undefined
}

function isPlatformCapabilityName(
  value: string
): value is PlatformCapabilityName {
  return PLATFORM_CAPABILITIES.includes(value as PlatformCapabilityName)
}
