import crypto from "node:crypto"
import {
  getGoogleAccessToken,
  getSeoAnalyticsConfig,
  querySearchAnalytics,
} from "../seo-analytics"

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
})

const serviceAccountJson = JSON.stringify({
  client_email: "gsc@project.iam.gserviceaccount.com",
  private_key: privateKey,
  token_uri: "https://oauth2.example.test/token",
})

function jsonResponse(body: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

describe("getSeoAnalyticsConfig", () => {
  it("reports status across configuration states", () => {
    expect(getSeoAnalyticsConfig({}).status).toBe("disabled")
    expect(getSeoAnalyticsConfig({ SEO_GSC_ENABLED: "true" }).status).toBe(
      "missing_config"
    )
    expect(
      getSeoAnalyticsConfig({
        SEO_GSC_ENABLED: "true",
        SEO_GSC_SITE_URL: "sc-domain:example.com",
      }).status
    ).toBe("missing_secret")
    expect(
      getSeoAnalyticsConfig({
        SEO_GSC_ENABLED: "true",
        SEO_GSC_SITE_URL: "sc-domain:example.com",
        SEO_GSC_SERVICE_ACCOUNT: "not json",
      }).status
    ).toBe("invalid")
    const ok = getSeoAnalyticsConfig({
      SEO_GSC_ENABLED: "true",
      SEO_GSC_SITE_URL: "sc-domain:example.com",
      SEO_GSC_SERVICE_ACCOUNT: serviceAccountJson,
    })
    expect(ok.status).toBe("configured")
    expect(ok.service_account_configured).toBe(true)
  })

  it("never exposes the raw service account", () => {
    const config = getSeoAnalyticsConfig({
      SEO_GSC_ENABLED: "true",
      SEO_GSC_SITE_URL: "sc-domain:example.com",
      SEO_GSC_SERVICE_ACCOUNT: serviceAccountJson,
    })
    expect(JSON.stringify(config)).not.toContain("BEGIN PRIVATE KEY")
  })
})

describe("getGoogleAccessToken", () => {
  it("mints and exchanges a correctly signed JWT", async () => {
    let assertion = ""
    const fetcher = jest.fn(async (_url: string, init?: { body?: string }) => {
      assertion = new URLSearchParams(init?.body || "").get("assertion") || ""
      return jsonResponse({ access_token: "ya29.test-token" })
    })

    const token = await getGoogleAccessToken({
      serviceAccount: {
        client_email: "gsc@project.iam.gserviceaccount.com",
        private_key: privateKey,
        token_uri: "https://oauth2.example.test/token",
      },
      fetcher: fetcher as never,
      now: 1_700_000_000_000,
    })

    expect(token).toBe("ya29.test-token")
    const [header, claim, signature] = assertion.split(".")
    expect(
      crypto
        .createVerify("RSA-SHA256")
        .update(`${header}.${claim}`)
        .verify(publicKey, Buffer.from(signature, "base64url"))
    ).toBe(true)
    const decoded = JSON.parse(Buffer.from(claim, "base64url").toString())
    expect(decoded.iss).toBe("gsc@project.iam.gserviceaccount.com")
    expect(decoded.scope).toContain("webmasters.readonly")
    expect(decoded.exp - decoded.iat).toBe(3600)
  })
})

describe("querySearchAnalytics", () => {
  const env = {
    SEO_GSC_ENABLED: "true",
    SEO_GSC_SITE_URL: "sc-domain:example.com",
    SEO_GSC_SERVICE_ACCOUNT: serviceAccountJson,
  }

  it("degrades gracefully when unconfigured", async () => {
    const result = await querySearchAnalytics({
      env: {},
      startDate: "2026-01-01",
      endDate: "2026-01-28",
    })
    expect(result).toMatchObject({ configured: false, status: "disabled", rows: [] })
  })

  it("exchanges a token then normalizes Search Console rows", async () => {
    const fetcher = jest.fn(async (url: string) => {
      if (url.includes("/token")) {
        return jsonResponse({ access_token: "ya29.test-token" })
      }
      return jsonResponse({
        rows: [
          { keys: ["https://example.com/products/x"], clicks: 12, impressions: 340, ctr: 0.035, position: 6.2 },
        ],
      })
    })

    const result = await querySearchAnalytics({
      env,
      fetcher: fetcher as never,
      now: 1_700_000_000_000,
      startDate: "2026-01-01",
      endDate: "2026-01-28",
      dimension: "page",
    })

    expect(result.configured).toBe(true)
    expect(result.rows).toEqual([
      {
        key: "https://example.com/products/x",
        clicks: 12,
        impressions: 340,
        ctr: 0.035,
        position: 6.2,
      },
    ])
    const calledUrls = fetcher.mock.calls.map((call) => call[0])
    expect(calledUrls.some((url) => url.includes("searchAnalytics/query"))).toBe(true)
  })
})
