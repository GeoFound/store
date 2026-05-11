import type { ReactNode } from "react"

export type StorefrontExtensionSlot = string

export type StorefrontExtensionComponent<
  TProps = Record<string, never>,
> = (props: TProps) => ReactNode

export type StorefrontExtensionRegistration<
  TProps = Record<string, never>,
> = {
  name: string
  pluginId: string
  slot: StorefrontExtensionSlot
  component: StorefrontExtensionComponent<TProps>
  enabled?: boolean
  order?: number
}

type AnyStorefrontExtensionRegistration =
  StorefrontExtensionRegistration<Record<string, unknown>>

const extensions = new Map<
  StorefrontExtensionSlot,
  AnyStorefrontExtensionRegistration[]
>()

export function registerStorefrontExtension<TProps = Record<string, never>>(
  registration: StorefrontExtensionRegistration<TProps>
) {
  const existing = extensions.get(registration.slot) || []
  const next = existing.filter((item) => item.name !== registration.name)
  next.push(registration as unknown as AnyStorefrontExtensionRegistration)
  extensions.set(registration.slot, next)
}

export function listStorefrontExtensions(slot: StorefrontExtensionSlot) {
  const disabledPlugins = getDisabledPluginIds()

  return (extensions.get(slot) || [])
    .filter((entry) => entry.enabled !== false)
    .filter((entry) => !disabledPlugins.has(entry.pluginId))
    .sort((a, b) => (a.order || 0) - (b.order || 0))
}

export function renderStorefrontExtensions<TProps = Record<string, never>>(
  slot: StorefrontExtensionSlot,
  props: TProps
) {
  return listStorefrontExtensions(slot).map((entry) => ({
    key: `${entry.pluginId}:${entry.name}`,
    node: (entry.component as StorefrontExtensionComponent<TProps>)(props),
  }))
}

export function resetStorefrontExtensionsForTests() {
  extensions.clear()
}

function getDisabledPluginIds() {
  const value =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_PLATFORM_DISABLED_PLUGINS ||
        process.env.PLATFORM_DISABLED_PLUGINS ||
        ""
      : ""

  return new Set(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  )
}
