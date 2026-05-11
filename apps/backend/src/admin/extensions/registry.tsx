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

const extensions = new Map<AdminExtensionSlot, AdminExtensionRegistration<any>[]>()

export function registerAdminExtension<TProps = Record<string, never>>(
  registration: AdminExtensionRegistration<TProps>
) {
  const existing = extensions.get(registration.slot) || []
  const next = existing.filter((item) => item.name !== registration.name)
  next.push(registration)
  extensions.set(registration.slot, next)
}

export function listAdminExtensions(slot: AdminExtensionSlot) {
  const disabledPlugins = getDisabledPluginIds()

  return (extensions.get(slot) || [])
    .filter((entry) => entry.enabled !== false)
    .filter((entry) => !disabledPlugins.has(entry.pluginId))
    .sort((a, b) => (a.order || 0) - (b.order || 0))
}

export function renderAdminExtensions<TProps = Record<string, never>>(
  slot: AdminExtensionSlot,
  props: TProps
) {
  return listAdminExtensions(slot).map((entry) => ({
    key: `${entry.pluginId}:${entry.name}`,
    node: entry.component(props),
  }))
}

export function resetAdminExtensionsForTests() {
  extensions.clear()
}

function getDisabledPluginIds() {
  const value =
    typeof process !== "undefined"
      ? process.env.PLATFORM_DISABLED_PLUGINS ||
        process.env.NEXT_PUBLIC_PLATFORM_DISABLED_PLUGINS ||
        ""
      : ""

  return new Set(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  )
}
