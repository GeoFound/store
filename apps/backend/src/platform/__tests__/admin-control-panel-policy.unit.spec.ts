import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { ADMIN_CONTROL_PANEL_POLICY } from "../admin-control-panel-policy"

describe("admin control panel policy", () => {
  it("keeps the runtime policy aligned with the machine-readable AI context", () => {
    const policyPath = resolve(
      process.cwd(),
      "../../.ai/admin-control-panel-policy.json"
    )
    const policy = JSON.parse(readFileSync(policyPath, "utf8"))

    expect(policy).toEqual(ADMIN_CONTROL_PANEL_POLICY)
  })
})
