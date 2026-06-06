import { validatePlatformProfileConfig } from "../config-validation"

describe("platform profile configuration validation", () => {
  it("accepts the default empty platform profile", () => {
    const result = validatePlatformProfileConfig({
      enabled_plugins: [],
      disabled_plugins: [],
      enabled_contracts: {},
      disabled_contracts: {},
    })

    expect(result.issues).toEqual([])
    expect(result.valid).toBe(true)
  })

  it("rejects unknown plugin ids", () => {
    const result = validatePlatformProfileConfig({
      enabled_plugins: ["plugin.missing"],
    })

    expect(result.valid).toBe(false)
    expect(result.issues).toContain('Unknown enabled plugin "plugin.missing"')
  })

  it("rejects unknown contract names", () => {
    const result = validatePlatformProfileConfig({
      disabled_contracts: {
        "payment-provider": ["missing-provider"],
      },
    })

    expect(result.valid).toBe(false)
    expect(result.issues).toContain(
      'disabled_contracts.payment-provider references unknown contract "missing-provider"'
    )
  })

  it("rejects product templates that reference disabled delivery handlers", () => {
    const result = validatePlatformProfileConfig({
      disabled_contracts: {
        "delivery-handler": ["credential"],
      },
    })

    expect(result.valid).toBe(false)
    expect(result.issues).toEqual(
      expect.arrayContaining([
        'Product template "credential" references unavailable delivery-handler "credential"',
        'Product template "account" references unavailable delivery-handler "credential"',
      ])
    )
  })

  it("rejects profiles without a real payment provider", () => {
    const result = validatePlatformProfileConfig({
      disabled_contracts: {
        "payment-provider": ["manual"],
      },
    })

    expect(result.valid).toBe(false)
    expect(result.issues).toContain(
      "At least one non-noop payment-provider contract must be enabled"
    )
  })
})
