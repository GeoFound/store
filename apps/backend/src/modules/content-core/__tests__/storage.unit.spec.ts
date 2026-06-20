import {
  createContentUploadPolicy,
  getContentStorageRuntimeConfig,
} from "../storage"

describe("content storage config", () => {
  it("defaults to local record-only storage when no providers are configured", () => {
    const config = getContentStorageRuntimeConfig({})

    expect(config).toMatchObject({
      default_provider_code: "local",
      providers: [
        {
          code: "local",
          kind: "local",
          bucket: "local-content-assets",
          upload_strategy: "record_only",
          status: "configured",
        },
      ],
    })
  })

  it("keeps S3 and R2 providers side by side with env-backed secrets", () => {
    const config = getContentStorageRuntimeConfig({
      CONTENT_STORAGE_DEFAULT_PROVIDER: "r2-main",
      CONTENT_STORAGE_PROVIDERS_JSON: JSON.stringify([
        {
          code: "s3-main",
          kind: "s3",
          bucket: "content-s3",
          region: "us-east-1",
          access_key_id_env: "S3_ACCESS_KEY_ID",
          secret_access_key_env: "S3_SECRET_ACCESS_KEY",
        },
        {
          code: "r2-main",
          kind: "r2",
          bucket: "content-r2",
          endpoint: "https://account.r2.cloudflarestorage.com",
          access_key_id_env: "R2_ACCESS_KEY_ID",
          secret_access_key_env: "R2_SECRET_ACCESS_KEY",
        },
      ]),
      S3_ACCESS_KEY_ID: "configured",
      S3_SECRET_ACCESS_KEY: "configured",
      R2_ACCESS_KEY_ID: "configured",
      R2_SECRET_ACCESS_KEY: "configured",
    })

    expect(config.default_provider_code).toBe("r2-main")
    expect(config.providers).toMatchObject([
      {
        code: "s3-main",
        kind: "s3",
        status: "configured",
        access_key_id_configured: true,
        secret_access_key_configured: true,
      },
      {
        code: "r2-main",
        kind: "r2",
        force_path_style: true,
        status: "configured",
      },
    ])
  })

  it("does not expose inline secret-like storage provider fields", () => {
    const config = getContentStorageRuntimeConfig({
      CONTENT_STORAGE_PROVIDERS_JSON: JSON.stringify([
        {
          code: "bad",
          kind: "s3",
          bucket: "content",
          access_key_id: "plain-access-key",
          secret_access_key: "plain-secret",
          access_key_id_env: "S3_ACCESS_KEY_ID",
          secret_access_key_env: "S3_SECRET_ACCESS_KEY",
        },
      ]),
      S3_ACCESS_KEY_ID: "configured",
      S3_SECRET_ACCESS_KEY: "configured",
    })

    expect(JSON.stringify(config)).not.toContain("plain-access-key")
    expect(JSON.stringify(config)).not.toContain("plain-secret")
    expect(config.providers[0]).toMatchObject({
      code: "bad",
      status: "invalid",
      issues: ["Inline secret-like fields are ignored; reference env names instead"],
    })
  })

  it("creates short-lived S3-compatible direct upload policies for R2", () => {
    const upload = createContentUploadPolicy({
      assetType: "audio",
      entryId: "entry_123",
      filename: "article.mp3",
      mimeType: "audio/mpeg",
      providerCode: "r2-main",
      siteId: "site-1",
      env: {
        CONTENT_STORAGE_PROVIDERS_JSON: JSON.stringify([
          {
            code: "r2-main",
            kind: "r2",
            bucket: "content-r2",
            endpoint: "https://account.r2.cloudflarestorage.com",
            public_base_url: "https://cdn.example.test",
            access_key_id_env: "R2_ACCESS_KEY_ID",
            secret_access_key_env: "R2_SECRET_ACCESS_KEY",
          },
        ]),
        R2_ACCESS_KEY_ID: "access-key",
        R2_SECRET_ACCESS_KEY: "secret-key",
      },
    })

    expect(upload).toMatchObject({
      provider_code: "r2-main",
      storage_provider: "r2",
      method: "PUT",
      bucket: "content-r2",
      headers: {
        "content-type": "audio/mpeg",
      },
    })
    expect(upload.object_key).toContain("site-1/content/entry_123/audio/")
    expect(upload.public_url).toContain("https://cdn.example.test/")
    expect(upload.upload_url).toContain("X-Amz-Signature=")
    expect(JSON.stringify(upload)).not.toContain("secret-key")
  })

  it("signs temporary (assumed-role) credentials with a security token in canonical order", () => {
    const upload = createContentUploadPolicy({
      assetType: "audio",
      entryId: "entry_123",
      filename: "article.mp3",
      providerCode: "s3-sts",
      env: {
        CONTENT_STORAGE_PROVIDERS_JSON: JSON.stringify([
          {
            code: "s3-sts",
            kind: "s3",
            bucket: "content-s3",
            region: "us-east-1",
            access_key_id_env: "S3_ACCESS_KEY_ID",
            secret_access_key_env: "S3_SECRET_ACCESS_KEY",
            session_token_env: "S3_SESSION_TOKEN",
          },
        ]),
        S3_ACCESS_KEY_ID: "access-key",
        S3_SECRET_ACCESS_KEY: "secret-key",
        S3_SESSION_TOKEN: "session-token-value/with+special=chars",
      },
    })

    const query = new URL(upload.upload_url).searchParams
    expect(query.get("X-Amz-Security-Token")).toBe(
      "session-token-value/with+special=chars"
    )
    expect(query.get("X-Amz-Signature")).toBeTruthy()

    // The security token must be covered by the signature, which requires it to
    // sit before X-Amz-SignedHeaders in the canonical (sorted) query string.
    const canonical = upload.upload_url.split("?")[1]
    expect(canonical.indexOf("X-Amz-Security-Token")).toBeLessThan(
      canonical.indexOf("X-Amz-SignedHeaders")
    )
    expect(JSON.stringify(upload)).not.toContain("secret-key")
  })

  it("reports session-token configuration status for STS providers", () => {
    const config = getContentStorageRuntimeConfig({
      CONTENT_STORAGE_PROVIDERS_JSON: JSON.stringify([
        {
          code: "s3-sts",
          kind: "s3",
          bucket: "content-s3",
          region: "us-east-1",
          access_key_id_env: "S3_ACCESS_KEY_ID",
          secret_access_key_env: "S3_SECRET_ACCESS_KEY",
          session_token_env: "S3_SESSION_TOKEN",
        },
      ]),
      S3_ACCESS_KEY_ID: "configured",
      S3_SECRET_ACCESS_KEY: "configured",
      S3_SESSION_TOKEN: "configured",
    })

    expect(config.providers[0]).toMatchObject({
      session_token_env: "S3_SESSION_TOKEN",
      session_token_configured: true,
    })
  })
})
