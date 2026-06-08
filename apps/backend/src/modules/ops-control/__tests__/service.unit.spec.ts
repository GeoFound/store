import OpsControlModuleService from "../service"

describe("ops control service", () => {
  it("redacts secret values and reports configured status", () => {
    const service = new OpsControlModuleService()
    const snapshot = service.getSecuritySnapshot({
      env: {
        SECURITY_RATE_LIMIT_STORE: "redis",
        SECURITY_HEADERS_ENABLED: "true",
        SECURITY_ENFORCE_ORIGIN_CHECKS: "true",
        SECURITY_TRUST_PROXY_HEADERS: "true",
        CLOUDFLARE_API_TOKEN: "secret-token",
      },
    })
    const tokenSetting = snapshot.settings.find(
      (setting) => setting.key === "CLOUDFLARE_API_TOKEN"
    )

    expect(tokenSetting).toMatchObject({
      configured: true,
      secret: true,
      value: null,
    })
    expect(JSON.stringify(snapshot)).not.toContain("secret-token")
  })

  it("marks non-redis production rate limiting as critical", () => {
    const service = new OpsControlModuleService()
    const snapshot = service.getSecuritySnapshot({
      env: {
        SECURITY_RATE_LIMIT_STORE: "memory",
      },
    })

    expect(snapshot.findings).toContainEqual(
      expect.objectContaining({
        id: "security.rate-limit-store-not-redis",
        severity: "critical",
      })
    )
  })

  it("keeps AI auto remediation behind a critical human gate", () => {
    const service = new OpsControlModuleService()
    const snapshot = service.getAiOpsSnapshot({
      env: {
        OPS_AI_AUTO_REMEDIATE_ENABLED: "true",
      },
    })

    expect(snapshot.findings).toContainEqual(
      expect.objectContaining({
        id: "ai-ops.auto-remediate-enabled",
        severity: "critical",
        human_gate: true,
      })
    )
  })

  it("summarizes dashboard findings across sections", () => {
    const service = new OpsControlModuleService()
    const snapshot = service.getDashboardSnapshot({
      env: {
        SECURITY_RATE_LIMIT_STORE: "memory",
        OPS_BACKUP_OFFSITE_ENABLED: "false",
      },
    })

    expect(snapshot.summary.status).toBe("critical")
    expect(snapshot.summary.critical_findings).toBeGreaterThanOrEqual(2)
    expect(snapshot.operator_actions).toContainEqual(
      expect.objectContaining({
        id: "deploy.rollback",
        requires_human_confirmation: true,
      })
    )
  })
})
