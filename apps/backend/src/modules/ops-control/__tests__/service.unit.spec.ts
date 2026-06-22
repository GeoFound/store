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

  it("reports launch readiness and control panel production surfaces", () => {
    const service = new OpsControlModuleService()
    const dashboard = service.getDashboardSnapshot({
      env: {
        NODE_ENV: "production",
        SITE_ID: "jp-cards",
        SITE_ENV: "production",
        STOREFRONT_PUBLIC_URL: "https://jp.example.com",
        API_PUBLIC_URL: "https://api.jp.example.com",
        EXPECT_CLOUDFLARE: "true",
        REQUIRE_CLOUDFLARE_SSL_MODE: "strict",
        CLOUDFLARE_ZONE_ID: "zone-id",
        CLOUDFLARE_API_TOKEN: "secret-cloudflare-token",
        CLOUDFLARE_WAF_MANAGED_RULES_ENABLED: "true",
        CLOUDFLARE_ACCESS_ADMIN_ENABLED: "true",
        SECURITY_RATE_LIMIT_STORE: "redis",
      },
    })

    expect(dashboard.launch_readiness.settings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "STOREFRONT_PUBLIC_URL",
          status: "ok",
        }),
        expect.objectContaining({
          key: "CLOUDFLARE_API_TOKEN",
          secret: true,
          value: null,
        }),
      ])
    )
    expect(dashboard.control_panel_policy.required_surfaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "dns-cloudflare-edge",
          production_gate_required: true,
        }),
        expect.objectContaining({
          id: "edge-security",
          runtime_commands: expect.arrayContaining([
            "pnpm deploy:waf",
            "pnpm deploy:admin-edge",
          ]),
        }),
        expect.objectContaining({
          id: "analytics-privacy",
          control_panel_section: "growth",
        }),
      ])
    )
    expect(
      dashboard.control_panel_policy.information_architecture.route_placements
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          route: "/app/ops",
          section: "risk_system",
        }),
        expect.objectContaining({
          route: "/app/after-sales",
          section: "customers_support",
        }),
      ])
    )
    expect(JSON.stringify(dashboard)).not.toContain("secret-cloudflare-token")
  })

  it("flags an accidental production no-index as a critical discoverability finding", () => {
    const service = new OpsControlModuleService()
    const dashboard = service.getDashboardSnapshot({
      env: {
        NODE_ENV: "production",
        SITE_ID: "jp-cards",
        SITE_ENV: "production",
        STOREFRONT_PUBLIC_URL: "https://jp.example.com",
        SEO_INDEXING_ENABLED: "false",
      },
    })

    const finding = dashboard.launch_readiness.findings.find(
      (item) => item.id === "launch.seo-indexing-disabled"
    )
    expect(finding).toBeTruthy()
    expect(finding?.severity).toBe("critical")
    expect(dashboard.launch_readiness.settings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "SEO_INDEXING_ENABLED", status: "warning" }),
      ])
    )
  })

  it("does not flag discoverability when indexing is enabled in production", () => {
    const service = new OpsControlModuleService()
    const dashboard = service.getDashboardSnapshot({
      env: {
        NODE_ENV: "production",
        SITE_ID: "jp-cards",
        SITE_ENV: "production",
        STOREFRONT_PUBLIC_URL: "https://jp.example.com",
        SEO_ENABLED: "true",
        SEO_INDEXING_ENABLED: "true",
        SITE_CANONICAL_URL: "https://jp.example.com",
      },
    })

    const ids = dashboard.launch_readiness.findings.map((item) => item.id)
    expect(ids).not.toContain("launch.seo-indexing-disabled")
    expect(ids).not.toContain("launch.seo-disabled")
    expect(ids).not.toContain("launch.seo-canonical-missing")
  })

  it("flags Cloudflare managed WAF as a human-gated security finding", () => {
    const service = new OpsControlModuleService()
    const snapshot = service.getSecuritySnapshot({
      env: {
        SECURITY_RATE_LIMIT_STORE: "redis",
        CLOUDFLARE_ACCESS_ADMIN_ENABLED: "true",
      },
    })

    expect(snapshot.findings).toContainEqual(
      expect.objectContaining({
        id: "security.cloudflare-waf-not-enabled",
        severity: "warning",
        human_gate: true,
      })
    )
  })

  it("reports missing backup encryption and least-privilege evidence", () => {
    const service = new OpsControlModuleService()
    const snapshot = service.getMaintenanceSnapshot({
      env: {
        OPS_BACKUP_OFFSITE_ENABLED: "true",
        OPS_BACKUP_ENCRYPTION_ENABLED: "false",
        OPS_APP_USER_LEAST_PRIVILEGE: "false",
      },
    })

    expect(snapshot.findings).toContainEqual(
      expect.objectContaining({
        id: "ops.backup-encryption-not-enabled",
        severity: "critical",
      })
    )
    expect(snapshot.findings).toContainEqual(
      expect.objectContaining({
        id: "ops.app-user-not-least-privilege",
        severity: "critical",
      })
    )
  })

  it("keeps AI auto remediation behind a critical human gate", () => {
    const service = new OpsControlModuleService()
    const snapshot = service.getDashboardSnapshot({
      env: {
        OPS_AI_AUTO_REMEDIATE_ENABLED: "true",
      },
    })

    expect(snapshot.ai_ops.findings).toContainEqual(
      expect.objectContaining({
        id: "ai-ops.auto-remediate-enabled",
        severity: "critical",
        human_gate: true,
      })
    )
  })

  it("redacts commerce provider secrets and reports readiness", () => {
    const service = new OpsControlModuleService()
    const snapshot = service.getCommerceSnapshot({
      env: {
        NODE_ENV: "production",
        API_PUBLIC_URL: "https://api.example.com",
        PLISIO_API_KEY: "plisio-secret",
        RELOADLY_CLIENT_ID: "reloadly-client",
        RELOADLY_CLIENT_SECRET: "reloadly-secret",
        SUPPLIER_ENCRYPTION_KEY: "supplier-key",
        CHECKOUT_OUT_OF_STOCK_POLICY: "allow_supplier_backorder",
      },
    })
    const plisioKey = snapshot.settings.find(
      (setting) => setting.key === "PLISIO_API_KEY"
    )
    const reloadlySecret = snapshot.settings.find(
      (setting) => setting.key === "RELOADLY_CLIENT_SECRET"
    )

    expect(plisioKey).toMatchObject({
      configured: true,
      secret: true,
      value: null,
    })
    expect(reloadlySecret).toMatchObject({
      configured: true,
      secret: true,
      value: null,
    })
    expect(snapshot.summary).toMatchObject({
      plisio_ready: true,
      reloadly_ready: true,
      out_of_stock_policy: "allow_supplier_backorder",
    })
    expect(JSON.stringify(snapshot)).not.toContain("plisio-secret")
    expect(JSON.stringify(snapshot)).not.toContain("reloadly-secret")
  })

  it("flags missing Plisio and Reloadly launch configuration", () => {
    const service = new OpsControlModuleService()
    const snapshot = service.getCommerceSnapshot({
      env: {
        NODE_ENV: "production",
      },
    })

    expect(snapshot.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "commerce.plisio-api-key-missing",
          severity: "critical",
        }),
        expect.objectContaining({
          id: "commerce.plisio-callback-base-url-missing",
          severity: "critical",
        }),
        expect.objectContaining({
          id: "commerce.reloadly-credentials-missing",
          severity: "warning",
        }),
      ])
    )
  })

  it("flags invalid out-of-stock checkout policy", () => {
    const service = new OpsControlModuleService()
    const snapshot = service.getCommerceSnapshot({
      env: {
        CHECKOUT_OUT_OF_STOCK_POLICY: "allow_everything",
      },
    })

    expect(snapshot.summary).toMatchObject({
      out_of_stock_policy: "invalid",
    })
    expect(snapshot.findings).toContainEqual(
      expect.objectContaining({
        id: "commerce.out-of-stock-policy-invalid",
        severity: "critical",
      })
    )
  })

  it("summarizes lightweight customer account policy", () => {
    const service = new OpsControlModuleService()
    const snapshot = service.getCustomerSnapshot({
      env: {
        NODE_ENV: "production",
        STOREFRONT_PUBLIC_URL: "https://store.example.com",
        CUSTOMER_ACCOUNT_MODE: "guest_optional",
        CUSTOMER_PASSWORD_RESET_ENABLED: "true",
        CUSTOMER_EMAIL_VERIFICATION_STRATEGY: "recovery_only",
        GOOGLE_CLIENT_SECRET: "google-secret",
      },
    })
    const googleSecret = snapshot.settings.find(
      (setting) => setting.key === "GOOGLE_CLIENT_SECRET"
    )

    expect(snapshot.summary).toMatchObject({
      customer_account_mode: "guest_optional",
      password_reset_enabled: true,
      email_verification_strategy: "recovery_only",
    })
    expect(googleSecret).toMatchObject({
      configured: true,
      secret: true,
      value: null,
    })
    expect(JSON.stringify(snapshot)).not.toContain("google-secret")
  })

  it("flags unsafe customer account policy combinations", () => {
    const service = new OpsControlModuleService()
    const snapshot = service.getCustomerSnapshot({
      env: {
        NODE_ENV: "production",
        CUSTOMER_ACCOUNT_MODE: "guest_optional",
        CUSTOMER_PASSWORD_RESET_ENABLED: "false",
        CUSTOMER_EMAIL_VERIFICATION_STRATEGY: "everything",
        GOOGLE_CLIENT_ID: "partial-google-client",
      },
    })

    expect(snapshot.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "customer.password-reset-disabled",
          severity: "warning",
        }),
        expect.objectContaining({
          id: "customer.email-verification-strategy-invalid",
          severity: "critical",
        }),
        expect.objectContaining({
          id: "customer.google-auth-partial-config",
          severity: "critical",
        }),
      ])
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
    expect(snapshot.commerce.settings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "PLISIO_API_KEY",
          secret: true,
        }),
      ])
    )
    expect(snapshot.customer.settings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "CUSTOMER_ACCOUNT_MODE",
        }),
      ])
    )
  })
})
