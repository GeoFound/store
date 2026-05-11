import {
  addSeconds,
  createRecoveryCode,
  createTokenHint,
  createTokenWithPrefix,
  hashToken,
} from "../token"

describe("token utils", () => {
  it("creates prefixed random tokens", () => {
    const token = createTokenWithPrefix("ord")

    expect(token.startsWith("ord_")).toBe(true)
    expect(token.length).toBeGreaterThan("ord_".length + 20)
  })

  it("creates recovery codes and stable hints", () => {
    const code = createRecoveryCode()

    expect(code).toMatch(/^\d{6}$/)
    expect(createTokenHint(code)).toBe(code.slice(-6))
  })

  it("hashes tokens deterministically and offsets dates", () => {
    const now = new Date("2026-05-10T00:00:00.000Z")

    expect(hashToken("abc123")).toBe(hashToken("abc123"))
    expect(hashToken("abc123")).not.toBe(hashToken("different"))
    expect(addSeconds(now, 90).toISOString()).toBe("2026-05-10T00:01:30.000Z")
  })
})
