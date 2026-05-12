import {
  resolveEncryptionKey,
  resolveEncryptionKeyRing,
  resolveSecuritySecret,
} from "../runtime-secrets"

const KEY_HEX_A =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
const KEY_HEX_B =
  "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"

describe("runtime secret helpers", () => {
  it("resolves strong runtime secrets", () => {
    expect(
      resolveSecuritySecret("JWT_SECRET", {
        env: {
          JWT_SECRET: "strong-random-jwt-secret",
        },
      })
    ).toBe("strong-random-jwt-secret")
  })

  it("resolves encryption key ring with previous keys and deduplicates values", () => {
    const keyRing = resolveEncryptionKeyRing("CREDENTIAL_ENCRYPTION_KEY", {
      previousNames: ["CREDENTIAL_ENCRYPTION_KEY_PREVIOUS"],
      env: {
        CREDENTIAL_ENCRYPTION_KEY: KEY_HEX_A,
        CREDENTIAL_ENCRYPTION_KEY_PREVIOUS: `${KEY_HEX_B}, ${KEY_HEX_A}`,
      },
    })

    expect(keyRing).toEqual([KEY_HEX_A, KEY_HEX_B])
  })

  it("uses fallback key name when primary key is missing", () => {
    const key = resolveEncryptionKey("DELIVERY_ENCRYPTION_KEY", {
      fallbackName: "CREDENTIAL_ENCRYPTION_KEY",
      env: {
        CREDENTIAL_ENCRYPTION_KEY: KEY_HEX_A,
      },
    })

    expect(key).toBe(KEY_HEX_A)
  })

  it("throws when previous key list contains invalid keys", () => {
    expect(() =>
      resolveEncryptionKeyRing("CREDENTIAL_ENCRYPTION_KEY", {
        previousNames: ["CREDENTIAL_ENCRYPTION_KEY_PREVIOUS"],
        env: {
          CREDENTIAL_ENCRYPTION_KEY: KEY_HEX_A,
          CREDENTIAL_ENCRYPTION_KEY_PREVIOUS: "not-a-valid-key",
        },
      })
    ).toThrow("CREDENTIAL_ENCRYPTION_KEY_PREVIOUS")
  })
})
