import {
  normalizeHost,
  parseTenantRuntimeOptionsFromEnv,
  resolveTenantContext,
} from "../tenant"

describe("tenant runtime", () => {
  it("requires explicit backend site identity", () => {
    expect(() => parseTenantRuntimeOptionsFromEnv({ SITE_ENV: "production" }))
      .toThrow(/SITE_ID is required/)
    expect(() => parseTenantRuntimeOptionsFromEnv({ SITE_ID: "site-1" }))
      .toThrow(/SITE_ENV is required/)
  })

  it("normalizes hosts from raw host, origin, and port inputs", () => {
    expect(normalizeHost("https://api.example.com/orders")).toBe("api.example.com")
    expect(normalizeHost("Example.com:443")).toBe("example.com")
    expect(normalizeHost("example.com.")).toBe("example.com")
  })

  it("resolves tenant context from an allowed host", () => {
    const options = parseTenantRuntimeOptionsFromEnv({
      SITE_ID: "site-1",
      SITE_ENV: "production",
      TENANCY_MODE: "dedicated",
      TENANT_ALLOWED_HOSTS: "example.com,api.example.com",
      TENANT_FAIL_ON_HOST_MISMATCH: "true",
    })

    expect(resolveTenantContext({ host: "api.example.com" }, options)).toEqual({
      siteId: "site-1",
      siteEnv: "production",
      deploymentMode: "dedicated",
      resolvedBy: "host",
      host: "api.example.com",
    })
  })

  it("fails when the request host is not allowed for the site", () => {
    const options = parseTenantRuntimeOptionsFromEnv({
      SITE_ID: "site-1",
      SITE_ENV: "production",
      TENANT_ALLOWED_HOSTS: "api.example.com",
    })

    expect(() =>
      resolveTenantContext({ host: "other.example.com" }, options)
    ).toThrow(/not allowed/)
  })

  it("fails when explicit site header conflicts with the runtime site", () => {
    const options = parseTenantRuntimeOptionsFromEnv({
      SITE_ID: "site-1",
      SITE_ENV: "production",
      TENANT_ALLOWED_HOSTS: "api.example.com",
    })

    expect(() =>
      resolveTenantContext(
        {
          host: "api.example.com",
          siteIdHeader: "site-2",
        },
        options
      )
    ).toThrow(/site header mismatch/)
  })

  it("blocks pooled and sharded modes until shared data-plane evidence exists", () => {
    expect(() =>
      parseTenantRuntimeOptionsFromEnv({
        SITE_ID: "site-1",
        SITE_ENV: "production",
        TENANCY_MODE: "pooled",
      })
    ).toThrow(/TENANT_SHARED_DATA_PLANE_READY=true/)
  })

  it("supports pooled and sharded deployment modes after explicit data-plane readiness", () => {
    expect(
      parseTenantRuntimeOptionsFromEnv({
        SITE_ID: "site-1",
        SITE_ENV: "production",
        TENANCY_MODE: "pooled",
        TENANT_SHARED_DATA_PLANE_READY: "true",
      }).deploymentMode
    ).toBe("pooled")

    expect(
      parseTenantRuntimeOptionsFromEnv({
        SITE_ID: "site-1",
        SITE_ENV: "production",
        TENANCY_MODE: "sharded",
        TENANT_SHARED_DATA_PLANE_READY: "true",
      }).deploymentMode
    ).toBe("sharded")
  })
})
