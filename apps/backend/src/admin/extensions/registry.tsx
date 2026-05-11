import type { ReactNode } from "react"

export type AdminExtensionSlot = string

export type AdminExtensionComponent<TProps = Record<string, never>> = (
  props: TProps
) => ReactNode

export type AdminExtensionRegistration<TProps = Record<string, never>> = {
  name: string
  pluginId: string
  slot: AdminExtensionSlot
  component: AdminExtensionComponent<TProps>
  enabled?: boolean
  order?: number
}

type AnyAdminExtensionRegistration =
  AdminExtensionRegistration<Record<string, unknown>>

const extensions = new Map<AdminExtensionSlot, AnyAdminExtensionRegistration[]>()

export function registerAdminExtension<TProps = Record<string, never>>(
  registration: AdminExtensionRegistration<TProps>
) {
  const incoming = registration as unknown as AnyAdminExtensionRegistration
  const existing = extensions.get(registration.slot) || []
  const next = existing.filter((item) => !isSameAdminExtension(item, incoming))
  next.push(incoming)
  extensions.set(registration.slot, next)
}

export function listAdminExtensions(slot: AdminExtensionSlot) {
  const enabledPlugins = getEnabledPluginIds()
  const disabledPlugins = getDisabledPluginIds()

  return (extensions.get(slot) || [])
    .filter((entry) => entry.enabled !== false)
    .filter((entry) =>
      enabledPlugins.size ? enabledPlugins.has(entry.pluginId) : true
    )
    .filter((entry) => !disabledPlugins.has(entry.pluginId))
    .sort((a, b) => (a.order || 0) - (b.order || 0))
}

export function renderAdminExtensions<TProps = Record<string, never>>(
  slot: AdminExtensionSlot,
  props: TProps
) {
  return listAdminExtensions(slot).map((entry) => ({
    key: `${entry.pluginId}:${entry.name}`,
    node: (entry.component as AdminExtensionComponent<TProps>)(props),
  }))
}

export function resetAdminExtensionsForTests() {
  extensions.clear()
}

function getDisabledPluginIds() {
  return new Set(
    typeof process !== "undefined"
      ? mergePluginEnvLists(
          process.env.PLATFORM_DISABLED_PLUGINS,
          process.env.NEXT_PUBLIC_PLATFORM_DISABLED_PLUGINS
        )
      : []
  )
}

function getEnabledPluginIds() {
  return new Set(
    typeof process !== "undefined"
      ? mergePluginEnvLists(
          process.env.PLATFORM_ENABLED_PLUGINS,
          process.env.NEXT_PUBLIC_PLATFORM_ENABLED_PLUGINS
        )
      : []
  )
}

function mergePluginEnvLists(...values: Array<string | undefined>) {
  const merged = values.flatMap(splitCommaList)
  return Array.from(new Set(merged))
}

function splitCommaList(value?: string) {
  return (value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function isSameAdminExtension(
  left: AnyAdminExtensionRegistration,
  right: AnyAdminExtensionRegistration
) {
  return left.pluginId === right.pluginId && left.name === right.name
}
