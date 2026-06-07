import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  registerStorefrontExtension,
  renderStorefrontExtensions,
  resetStorefrontExtensionsForTests,
} from "./registry"

const PLUGIN_ENV_KEYS = [
  "PLATFORM_ENABLED_PLUGINS",
  "PLATFORM_DISABLED_PLUGINS",
  "NEXT_PUBLIC_PLATFORM_ENABLED_PLUGINS",
  "NEXT_PUBLIC_PLATFORM_DISABLED_PLUGINS",
] as const

const originalPluginEnv = Object.fromEntries(
  PLUGIN_ENV_KEYS.map((key) => [key, process.env[key]])
)

describe("storefront extension registry", () => {
  beforeEach(() => {
    resetStorefrontExtensionsForTests()
    for (const key of PLUGIN_ENV_KEYS) {
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of PLUGIN_ENV_KEYS) {
      const value = originalPluginEnv[key]
      if (typeof value === "undefined") {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })

  it("renders enabled extensions in slot order", () => {
    registerStorefrontExtension({
      name: "late",
      pluginId: "plugin-a",
      slot: "layout.body.end",
      order: 20,
      component: () => "late",
    })
    registerStorefrontExtension({
      name: "early",
      pluginId: "plugin-b",
      slot: "layout.body.end",
      order: 10,
      component: () => "early",
    })

    expect(renderStorefrontExtensions("layout.body.end", {})).toEqual([
      {
        key: "plugin-b:early",
        node: "early",
      },
      {
        key: "plugin-a:late",
        node: "late",
      },
    ])
  })

  it("filters storefront extensions with public plugin env only", () => {
    process.env.PLATFORM_DISABLED_PLUGINS = "plugin-a"

    registerStorefrontExtension({
      name: "public-env-only",
      pluginId: "plugin-a",
      slot: "layout.body.end",
      component: () => "visible",
    })

    expect(renderStorefrontExtensions("layout.body.end", {})).toEqual([
      {
        key: "plugin-a:public-env-only",
        node: "visible",
      },
    ])

    process.env.NEXT_PUBLIC_PLATFORM_DISABLED_PLUGINS = "plugin-a"

    expect(renderStorefrontExtensions("layout.body.end", {})).toEqual([])
  })
})
