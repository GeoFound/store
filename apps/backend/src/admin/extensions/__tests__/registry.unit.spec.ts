import { ReactNode } from "react"
import {
  ensureAdminExtensionsRegistered,
  resetAdminExtensionDefaultsForTests,
} from "../defaults"
import {
  listAdminExtensions,
  registerAdminExtension,
  renderAdminExtensions,
  resetAdminExtensionsForTests,
} from "../registry"

describe("admin extension registry", () => {
  beforeEach(() => {
    resetAdminExtensionsForTests()
    resetAdminExtensionDefaultsForTests()
  })

  it("registers default plugin-owned extension slots once", () => {
    ensureAdminExtensionsRegistered()
    ensureAdminExtensionsRegistered()

    expect(listAdminExtensions("payments.after")).toHaveLength(2)
    expect(listAdminExtensions("deliveries.after")).toHaveLength(1)
    expect(listAdminExtensions("payments.after")[0]).toMatchObject({
      pluginId: "support-audit",
      name: "support-audit.payment-ops-note",
    })
    expect(listAdminExtensions("payments.after")[1]).toMatchObject({
      pluginId: "marketing-engine",
      name: "marketing-engine.checkout-context-note",
    })
  })

  it("renders enabled extensions in order", () => {
    registerAdminExtension({
      name: "payments.low",
      pluginId: "plugin-a",
      slot: "payments.after",
      order: 20,
      component: () => "late" as ReactNode,
    })
    registerAdminExtension({
      name: "payments.high",
      pluginId: "plugin-b",
      slot: "payments.after",
      order: 10,
      component: () => "early" as ReactNode,
    })
    registerAdminExtension({
      name: "payments.disabled",
      pluginId: "plugin-c",
      slot: "payments.after",
      order: 5,
      enabled: false,
      component: () => "disabled" as ReactNode,
    })

    expect(renderAdminExtensions("payments.after", {})).toEqual([
      {
        key: "plugin-b:payments.high",
        node: "early",
      },
      {
        key: "plugin-a:payments.low",
        node: "late",
      },
    ])
  })
})
