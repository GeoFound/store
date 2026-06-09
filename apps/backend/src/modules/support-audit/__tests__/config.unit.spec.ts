import { getAuditRetentionConfig } from "../config"

describe("audit retention config", () => {
  it("defaults to enabled retention with a 365 day window", () => {
    expect(getAuditRetentionConfig({})).toEqual({
      enabled: true,
      retentionDays: 365,
      minimumRetentionDays: 90,
      batchSize: 1000,
    })
  })

  it("accepts explicit retention settings", () => {
    expect(
      getAuditRetentionConfig({
        AUDIT_LOG_RETENTION_ENABLED: "false",
        AUDIT_LOG_RETENTION_DAYS: "180",
        AUDIT_LOG_RETENTION_MIN_DAYS: "30",
        AUDIT_LOG_RETENTION_PRUNE_BATCH_SIZE: "250",
      })
    ).toEqual({
      enabled: false,
      retentionDays: 180,
      minimumRetentionDays: 30,
      batchSize: 250,
    })
  })

  it("rejects retention windows below the configured minimum", () => {
    expect(() =>
      getAuditRetentionConfig({
        AUDIT_LOG_RETENTION_DAYS: "30",
        AUDIT_LOG_RETENTION_MIN_DAYS: "90",
      })
    ).toThrow("AUDIT_LOG_RETENTION_DAYS")
  })
})
