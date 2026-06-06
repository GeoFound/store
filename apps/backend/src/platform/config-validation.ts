import type { PlatformCapabilityName } from "./contracts"
import { PLATFORM_CAPABILITIES } from "./contracts"
import {
  configurePlatformRuntime,
  getPlatformRuntime,
  resetPlatformRuntimeForTests,
} from "./runtime"
import { ensurePlatformIntegrationsRegistered } from "./integrations"
import { listProductTemplates } from "./product-templates"

export type PlatformProfileConfigInput = {
  enabledPlugins?: unknown
  enabled_plugins?: unknown
  disabledPlugins?: unknown
  disabled_plugins?: unknown
  enabledContracts?: unknown
  enabled_contracts?: unknown
  disabledContracts?: unknown
  disabled_contracts?: unknown
}

export type NormalizedPlatformProfileConfig = {
  enabledPlugins: string[]
  disabledPlugins: string[]
  enabledContracts: Partial<Record<PlatformCapabilityName, string[]>>
  disabledContracts: Partial<Record<PlatformCapabilityName, string[]>>
}

export type PlatformConfigValidationResult = {
  valid: boolean
  issues: string[]
  config: NormalizedPlatformProfileConfig
}

export function validatePlatformProfileConfig(
  input?: PlatformProfileConfigInput | null
): PlatformConfigValidationResult {
  const issues: string[] = []
  const config = normalizePlatformProfileConfig(input, issues)

  resetPlatformRuntimeForTests()

  try {
    configurePlatformRuntime({
      enabledPlugins: config.enabledPlugins,
      disabledPlugins: config.disabledPlugins,
      enabledContracts: config.enabledContracts,
      disabledContracts: config.disabledContracts,
    })
    ensurePlatformIntegrationsRegistered()

    const runtime = getPlatformRuntime()
    const knownPlugins = new Set(
      runtime.listPlugins().map((plugin) => plugin.id)
    )

    for (const pluginId of config.enabledPlugins) {
      if (!knownPlugins.has(pluginId)) {
        issues.push(`Unknown enabled plugin "${pluginId}"`)
      }
    }

    for (const pluginId of config.disabledPlugins) {
      if (!knownPlugins.has(pluginId)) {
        issues.push(`Unknown disabled plugin "${pluginId}"`)
      }
    }

    validateConfiguredContracts(
      "enabled_contracts",
      config.enabledContracts,
      issues
    )
    validateConfiguredContracts(
      "disabled_contracts",
      config.disabledContracts,
      issues
    )

    validateRequiredPaymentProvider(issues)
    validateRequiredOrderAccessProvider(issues)
    validateProductTemplateCapabilities(issues)
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error))
  } finally {
    resetPlatformRuntimeForTests()
  }

  return {
    valid: issues.length === 0,
    issues,
    config,
  }
}

function normalizePlatformProfileConfig(
  input: PlatformProfileConfigInput | null | undefined,
  issues: string[]
): NormalizedPlatformProfileConfig {
  return {
    enabledPlugins: toStringArray(
      input?.enabledPlugins ?? input?.enabled_plugins,
      "enabled_plugins",
      issues
    ),
    disabledPlugins: toStringArray(
      input?.disabledPlugins ?? input?.disabled_plugins,
      "disabled_plugins",
      issues
    ),
    enabledContracts: toCapabilityMap(
      input?.enabledContracts ?? input?.enabled_contracts,
      "enabled_contracts",
      issues
    ),
    disabledContracts: toCapabilityMap(
      input?.disabledContracts ?? input?.disabled_contracts,
      "disabled_contracts",
      issues
    ),
  }
}

function toStringArray(value: unknown, field: string, issues: string[]) {
  if (typeof value === "undefined" || value === null) {
    return []
  }

  if (!Array.isArray(value)) {
    issues.push(`${field} must be an array of strings`)
    return []
  }

  return Array.from(
    new Set(
      value
        .map((item) => toOptionalString(item))
        .filter((item): item is string => Boolean(item))
    )
  )
}

function toCapabilityMap(
  value: unknown,
  field: string,
  issues: string[]
): Partial<Record<PlatformCapabilityName, string[]>> {
  if (typeof value === "undefined" || value === null) {
    return {}
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    issues.push(`${field} must be an object keyed by platform capability`)
    return {}
  }

  const result: Partial<Record<PlatformCapabilityName, string[]>> = {}

  for (const [rawCapability, rawNames] of Object.entries(
    value as Record<string, unknown>
  )) {
    const capability = toOptionalString(rawCapability)

    if (!capability) {
      issues.push(`${field} contains an empty capability key`)
      continue
    }

    if (!isPlatformCapabilityName(capability)) {
      issues.push(`${field} contains unsupported capability "${capability}"`)
      continue
    }

    const names = toStringArray(
      rawNames,
      `${field}.${capability}`,
      issues
    )

    if (names.length) {
      result[capability] = names
    }
  }

  return result
}

function validateConfiguredContracts(
  field: string,
  contracts: Partial<Record<PlatformCapabilityName, string[]>>,
  issues: string[]
) {
  const runtime = getPlatformRuntime()

  for (const [capability, names] of Object.entries(contracts) as Array<
    [PlatformCapabilityName, string[]]
  >) {
    const knownNames = new Set(
      runtime.listContracts(capability).map((contract) => contract.name)
    )

    for (const name of names) {
      if (!knownNames.has(name)) {
        issues.push(
          `${field}.${capability} references unknown contract "${name}"`
        )
      }
    }
  }
}

function validateRequiredPaymentProvider(issues: string[]) {
  const runtime = getPlatformRuntime()
  const hasRealProvider = runtime
    .listContracts("payment-provider")
    .some(
      (contract) =>
        contract.name !== "noop" &&
        Boolean(
          runtime.resolveContract(
            "payment-provider",
            contract.name
          )
        )
    )

  if (!hasRealProvider) {
    issues.push(
      "At least one non-noop payment-provider contract must be enabled"
    )
  }
}

function validateRequiredOrderAccessProvider(issues: string[]) {
  const runtime = getPlatformRuntime()

  if (!runtime.resolveContract("order-access-provider", "guest-order-access")) {
    issues.push(
      "order-access-provider:guest-order-access must be enabled for guest checkout recovery"
    )
  }
}

function validateProductTemplateCapabilities(issues: string[]) {
  const runtime = getPlatformRuntime()

  for (const template of listProductTemplates()) {
    if (
      !runtime.resolveContract("product-policy", template.fulfillmentPolicyCode)
    ) {
      issues.push(
        `Product template "${template.code}" references unavailable product-policy "${template.fulfillmentPolicyCode}"`
      )
    }

    if (!runtime.resolveContract("delivery-handler", template.deliveryHandlerCode)) {
      issues.push(
        `Product template "${template.code}" references unavailable delivery-handler "${template.deliveryHandlerCode}"`
      )
    }

    if (
      template.inventoryHandlerCode &&
      !runtime.resolveContract(
        "inventory-handler",
        template.inventoryHandlerCode
      )
    ) {
      issues.push(
        `Product template "${template.code}" references unavailable inventory-handler "${template.inventoryHandlerCode}"`
      )
    }
  }
}

function isPlatformCapabilityName(
  value: string
): value is PlatformCapabilityName {
  return PLATFORM_CAPABILITIES.includes(value as PlatformCapabilityName)
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}
