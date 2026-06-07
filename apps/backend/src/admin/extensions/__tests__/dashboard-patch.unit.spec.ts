import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const dashboardPatchPath = resolve(
  process.cwd(),
  "../../patches/@medusajs__dashboard@2.14.2.patch"
)

describe("Medusa Dashboard shell patch", () => {
  const patch = readFileSync(dashboardPatchPath, "utf8")

  it("opens the custom control panel instead of the default orders page", () => {
    expect(patch).toContain('+    navigate("/control-panel", { replace: true })')
    expect(patch).toContain('-    navigate("/orders", { replace: true })')
  })

  it("uses grouped operational routes as the main sidebar navigation", () => {
    expect(patch).toContain("+            <OperationalRouteSection />")
    expect(patch).toContain("-            <CoreRouteSection />")
    expect(patch).toContain("-            <ExtensionRouteSection />")
    expect(patch).toContain('+      label: t("adminNav.sections.catalog"),')
    expect(patch).toContain('+      label: t("adminNav.sections.orders"),')
    expect(patch).toContain('+      label: t("adminNav.sections.inventory"),')
    expect(patch).toContain('+      label: t("adminNav.sections.paymentsSuppliers"),')
    expect(patch).toContain('+      label: t("adminNav.sections.growth"),')
    expect(patch).toContain('+      label: t("adminNav.sections.customers"),')
    expect(patch).toContain('+      label: t("adminNav.sections.riskSystem"),')
  })

  it("keeps core Medusa commerce routes reachable", () => {
    for (const route of [
      "/products",
      "/products/create",
      "/orders",
      "/inventory",
      "/reservations",
      "/customers",
      "/customer-groups",
      "/promotions",
      "/campaigns",
      "/price-lists",
    ]) {
      expect(patch).toContain(`to: "${route}"`)
    }
    expect(patch).toContain('to: "/product-publishing"')
    expect(patch).toContain('to: "/credentials"')
    expect(patch).toContain('to: "/deliveries"')
    expect(patch).toContain('to: "/payments"')
  })

  it("patches the distributed dashboard runtime files", () => {
    expect(patch).toContain("diff --git a/dist/app.js b/dist/app.js")
    expect(patch).toMatch(/diff --git a\/dist\/chunk-[A-Z0-9]+\.mjs/)
    expect(patch).toMatch(/diff --git a\/dist\/home-[A-Z0-9]+\.mjs/)
    expect(patch).toContain("+    OperationalRouteSection = () => {")
    expect(patch).toContain("+var OperationalRouteSection = () => {")
    expect(patch).toContain('+          label: t5("adminNav.sections.catalog"),')
    expect(patch).toContain('+      label: t2("adminNav.sections.catalog"),')
    expect(patch).toContain("-    CoreRouteSection = () => {")
    expect(patch).toContain("-var CoreRouteSection = () => {")
    expect(patch).toContain('+        navigate("/control-panel", { replace: true });')
    expect(patch).toContain('-        navigate("/orders", { replace: true });')
  })
})
