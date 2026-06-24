import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  createSalesChannel,
  createDigitalDelivery,
  createCustomer,
  createContentAiTask,
  createContentAsset,
  createContentEntry,
  createContentUploadPolicy,
  createMarketingCampaign,
  createMarketingCoupon,
  createMarketingReferral,
  importCredentialBatch,
  loadAfterSales,
  loadAIPolicy,
  loadAIProviders,
  loadAIRuns,
  loadAnalyticsDispatches,
  loadAnalyticsEvents,
  loadAuditLogs,
  loadCustomers,
  loadCredentialInventory,
  loadContentWorkspace,
  loadDeliveryWorkspace,
  loadMarketingWorkspace,
  loadOpsDashboard,
  loadOpsMaintenance,
  loadOpsSecurity,
  loadOrders,
  loadPaymentWorkspace,
  loadProductCatalog,
  loadProductPublishingWorkspace,
  loadSeoPerformance,
  loadSeoWorkspace,
  loadSupplierWorkspace,
  loadSystemSettings,
  publishContentEntrySnapshot,
  queueContentEntryTask,
  registerContentAudioFromAsset,
  replayAnalyticsDispatch,
  retrieveOrder,
  runContentAiTask,
  saveSupplierMapping,
  suggestSeoDocument,
  togglePaymentChannel,
  updateContentEntryStatus,
  updateContentTaskReview,
  updateStoreName,
  upsertSeoDocument,
} from "./product-admin-api"

const adminApiMock = vi.hoisted(() => vi.fn())

vi.mock("./admin-api", () => ({
  adminApi: adminApiMock,
}))

describe("product admin facade", () => {
  beforeEach(() => {
    adminApiMock.mockReset()
  })

  it("maps product catalog responses to product-admin DTOs", async () => {
    adminApiMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/admin/products?")) {
        return {
          products: [
            {
              id: "prod_1",
              title: "Gift card",
              handle: "gift-card",
              status: "published",
              variants: [
                {
                  id: "variant_1",
                  title: "Default",
                  sku: "GC-001",
                  manage_inventory: true,
                  allow_backorder: false,
                  prices: [{ currency_code: "usd", amount: 1999 }],
                },
              ],
              sales_channels: [
                { id: "sc_1", name: "Web", is_disabled: false },
              ],
              created_at: "2026-06-01T00:00:00.000Z",
              updated_at: "2026-06-02T00:00:00.000Z",
            },
          ],
          count: 1,
        }
      }

      if (path.startsWith("/admin/product-categories")) {
        return { product_categories: [{ id: "pcat_1", name: "Games" }] }
      }

      if (path.startsWith("/admin/collections")) {
        return { collections: [{ id: "pcol_1", title: "Featured" }] }
      }

      if (path.startsWith("/admin/product-types")) {
        return { product_types: [{ id: "ptyp_1", value: "credential" }] }
      }

      if (path.startsWith("/admin/product-tags")) {
        return { product_tags: [{ id: "ptag_1", value: "instant" }] }
      }

      if (path.startsWith("/admin/sales-channels")) {
        return { sales_channels: [{ id: "sc_1", name: "Web" }] }
      }

      throw new Error(`Unexpected path: ${path}`)
    })

    const catalog = await loadProductCatalog("gift")

    expect(catalog.products).toEqual([
      {
        id: "prod_1",
        title: "Gift card",
        handle: "gift-card",
        status: "published",
        thumbnail: null,
        variants: [
          {
            id: "variant_1",
            title: "Default",
            sku: "GC-001",
            managesInventory: true,
            allowsBackorder: false,
            prices: [{ currencyCode: "usd", amount: 1999 }],
          },
        ],
        salesChannels: [{ id: "sc_1", name: "Web", isDisabled: false }],
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-02T00:00:00.000Z",
      },
    ])
    expect(catalog.products[0]).not.toHaveProperty("sales_channels")
    expect(catalog.products[0].variants[0]).not.toHaveProperty(
      "manage_inventory",
    )
  })

  it("maps publishing and credential inventory workspaces to shared product DTOs", async () => {
    adminApiMock.mockImplementation(async (path: string) => {
      if (path === "/admin/product-templates") {
        return {
          templates: [
            {
              code: "credential",
              title: "Credential",
              description: "Credential inventory",
              productType: "credential",
              fulfillmentPolicyCode: "instant",
              deliveryHandlerCode: "digital-delivery",
              inventoryHandlerCode: "credential-inventory",
            },
          ],
        }
      }

      if (path === "/admin/catalog/variants") {
        return {
          variants: [
            {
              id: "variant_1",
              title: "Default",
              sku: "GC-001",
              product_id: "prod_1",
              product_title: "Gift card",
              product_handle: "gift-card",
              product_type: "credential",
              template_code: "credential",
              template_title: "Credential",
              inventory_handler_code: "credential-inventory",
              delivery_handler_code: "digital-delivery",
              credential_inventory_supported: true,
              availability_supported: true,
              total_count: 5,
              available_count: 3,
              reserved_count: 1,
              sold_count: 1,
              locked_count: 0,
              is_in_stock: true,
            },
          ],
        }
      }

      if (path === "/admin/credential-inventory/items") {
        return {
          items: [
            {
              id: "item_1",
              product_variant_id: "variant_1",
              status: "in_stock",
              display_label: "Card 1",
              account_identifier: "CARD-1",
              order_id: null,
              cart_id: null,
              delivered_at: null,
            },
          ],
        }
      }

      if (path === "/admin/credential-inventory/batches") {
        return {
          batches: [
            {
              id: "batch_1",
              name: "Batch",
              product_variant_id: "variant_1",
              status: "active",
              total_count: 5,
              available_count: 3,
              reserved_count: 1,
              sold_count: 1,
            },
          ],
        }
      }

      throw new Error(`Unexpected path: ${path}`)
    })

    const publishing = await loadProductPublishingWorkspace()
    const credentials = await loadCredentialInventory()

    expect(publishing.variants[0]).toMatchObject({
      productId: "prod_1",
      productTitle: "Gift card",
      templateCode: "credential",
      inventoryHandlerCode: "credential-inventory",
      credentialInventorySupported: true,
      availableCount: 3,
    })
    expect(publishing.variants[0]).not.toHaveProperty("product_id")
    expect(credentials.items[0]).toMatchObject({
      productVariantId: "variant_1",
      displayLabel: "Card 1",
      accountIdentifier: "CARD-1",
    })
    expect(credentials.batches[0]).toMatchObject({
      productVariantId: "variant_1",
      availableCount: 3,
      totalCount: 5,
    })
  })

  it("maps credential batch imports from product input to current backend body", async () => {
    adminApiMock.mockResolvedValue({ batch: { id: "batch_1" } })

    await importCredentialBatch({
      name: "Batch",
      productVariantId: "variant_1",
      templateCode: "credential",
      items: [
        {
          accountIdentifier: "CARD-1",
          displayLabel: "Card 1",
          credential: "secret",
        },
      ],
    })

    expect(adminApiMock).toHaveBeenCalledWith(
      "/admin/credential-inventory/batches",
      {
        method: "POST",
        body: {
          name: "Batch",
          product_variant_id: "variant_1",
          template_code: "credential",
          items: [
            {
              account_identifier: "CARD-1",
              display_label: "Card 1",
              credential: "secret",
            },
          ],
        },
      },
    )
  })

  it("maps order list and detail responses to order DTOs", async () => {
    const orderPayload = {
      id: "order_1",
      display_id: 101,
      email: "buyer@example.com",
      status: "pending",
      payment_status: "captured",
      fulfillment_status: "not_fulfilled",
      total: 2599,
      currency_code: "usd",
      customer: {
        id: "cus_1",
        email: "buyer@example.com",
        first_name: "Ada",
        last_name: "Lovelace",
      },
      items: [
        {
          id: "item_1",
          title: "Gift card",
          subtitle: "Default",
          quantity: 1,
          unit_price: 2599,
          total: 2599,
        },
      ],
      payment_collections: [
        { id: "paycol_1", status: "completed", amount: 2599 },
      ],
      fulfillments: [
        {
          id: "ful_1",
          status: "pending",
          delivered_at: null,
        },
      ],
      created_at: "2026-06-03T00:00:00.000Z",
      updated_at: "2026-06-04T00:00:00.000Z",
    }
    adminApiMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/admin/orders?")) {
        return { orders: [orderPayload], count: 1 }
      }

      if (path.startsWith("/admin/orders/order_1?")) {
        return { order: orderPayload }
      }

      throw new Error(`Unexpected path: ${path}`)
    })

    const list = await loadOrders("buyer")
    const detail = await retrieveOrder("order_1")

    expect(list.orders[0]).toMatchObject({
      id: "order_1",
      displayId: 101,
      paymentStatus: "captured",
      fulfillmentStatus: "not_fulfilled",
      currencyCode: "usd",
      customer: {
        firstName: "Ada",
        lastName: "Lovelace",
      },
      items: [{ unitPrice: 2599, total: 2599 }],
      paymentCollections: [{ id: "paycol_1", amount: 2599 }],
      fulfillments: [{ id: "ful_1", deliveredAt: null }],
      createdAt: "2026-06-03T00:00:00.000Z",
      updatedAt: "2026-06-04T00:00:00.000Z",
    })
    expect(detail).toEqual(list.orders[0])
    expect(list.orders[0]).not.toHaveProperty("payment_status")
    expect(list.orders[0].items[0]).not.toHaveProperty("unit_price")
  })

  it("maps customers to customer DTOs and keeps create input product-shaped", async () => {
    adminApiMock.mockImplementation(async (path: string, options?: unknown) => {
      if (path.startsWith("/admin/customers?")) {
        return {
          customers: [
            {
              id: "cus_1",
              email: "buyer@example.com",
              first_name: "Ada",
              last_name: "Lovelace",
              phone: "+15550100",
              has_account: true,
              groups: [{ id: "cgrp_1", name: "VIP" }],
              created_at: "2026-06-03T00:00:00.000Z",
              updated_at: "2026-06-04T00:00:00.000Z",
            },
          ],
          count: 1,
        }
      }

      if (path === "/admin/customer-groups?limit=100") {
        return {
          customer_groups: [
            {
              id: "cgrp_1",
              name: "VIP",
              created_at: "2026-06-01T00:00:00.000Z",
            },
          ],
        }
      }

      if (path === "/admin/customers") {
        return { customer: { id: "cus_2" }, options }
      }

      throw new Error(`Unexpected path: ${path}`)
    })

    const workspace = await loadCustomers("buyer")

    expect(workspace.customers[0]).toEqual({
      id: "cus_1",
      email: "buyer@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      phone: "+15550100",
      hasAccount: true,
      groups: [
        {
          id: "cgrp_1",
          name: "VIP",
          createdAt: null,
        },
      ],
      createdAt: "2026-06-03T00:00:00.000Z",
      updatedAt: "2026-06-04T00:00:00.000Z",
    })
    expect(workspace.groups[0]).toEqual({
      id: "cgrp_1",
      name: "VIP",
      createdAt: "2026-06-01T00:00:00.000Z",
    })

    await createCustomer({
      email: "new@example.com",
      firstName: "Grace",
      lastName: "Hopper",
      phone: "+15550101",
    })

    expect(adminApiMock).toHaveBeenLastCalledWith("/admin/customers", {
      method: "POST",
      body: {
        email: "new@example.com",
        first_name: "Grace",
        last_name: "Hopper",
        phone: "+15550101",
      },
    })
  })

  it("maps system settings responses to product-admin DTOs", async () => {
    adminApiMock.mockImplementation(async (path: string) => {
      if (path === "/admin/stores?limit=20") {
        return {
          stores: [
            {
              id: "store_1",
              name: "Main store",
              default_region_id: "reg_1",
              default_sales_channel_id: "sc_1",
              supported_currencies: [
                {
                  currency_code: "usd",
                  is_default: true,
                  is_tax_inclusive: false,
                },
              ],
              supported_locales: [{ locale_code: "en-US" }],
              updated_at: "2026-06-12T00:00:00.000Z",
            },
          ],
        }
      }

      if (path === "/admin/users?limit=100") {
        return {
          users: [
            {
              id: "user_1",
              email: "admin@example.com",
              first_name: "Ada",
              last_name: "Admin",
              created_at: "2026-06-01T00:00:00.000Z",
            },
          ],
        }
      }

      if (path === "/admin/regions?limit=100") {
        return {
          regions: [
            {
              id: "reg_1",
              name: "United States",
              currency_code: "usd",
              countries: [{ iso_2: "us", display_name: "United States" }],
              payment_providers: [{ id: "manual" }],
              automatic_taxes: true,
              is_tax_inclusive: false,
            },
          ],
        }
      }

      if (path === "/admin/sales-channels?limit=100") {
        return {
          sales_channels: [
            {
              id: "sc_1",
              name: "Web",
              description: "Primary storefront",
              is_disabled: false,
              created_at: "2026-06-02T00:00:00.000Z",
            },
          ],
        }
      }

      if (path === "/admin/api-keys?limit=100") {
        return {
          api_keys: [
            {
              id: "apk_1",
              title: "Publishable",
              type: "publishable",
              redacted: "pk_...",
              revoked_at: null,
              created_at: "2026-06-03T00:00:00.000Z",
            },
          ],
        }
      }

      if (path === "/admin/feature-flags") {
        return {
          feature_flags: [
            { key: "inventory", name: "Inventory", enabled: true, value: "on" },
          ],
        }
      }

      if (path === "/admin/plugins") {
        return {
          plugins: [
            {
              name: "payment-manual",
              version: "1.0.0",
              resolve: "@local/payment-manual",
              options: { enabled: true },
            },
          ],
        }
      }

      throw new Error(`Unexpected path: ${path}`)
    })

    const settings = await loadSystemSettings()

    expect(settings.stores[0]).toEqual({
      id: "store_1",
      name: "Main store",
      defaultRegionId: "reg_1",
      defaultSalesChannelId: "sc_1",
      supportedCurrencies: [
        {
          currencyCode: "usd",
          isDefault: true,
          isTaxInclusive: false,
        },
      ],
      supportedLocales: [{ localeCode: "en-US" }],
      updatedAt: "2026-06-12T00:00:00.000Z",
    })
    expect(settings.users[0]).toEqual({
      id: "user_1",
      email: "admin@example.com",
      firstName: "Ada",
      lastName: "Admin",
      createdAt: "2026-06-01T00:00:00.000Z",
    })
    expect(settings.regions[0]).toEqual({
      id: "reg_1",
      name: "United States",
      currencyCode: "usd",
      countries: [{ iso2: "us", displayName: "United States" }],
      paymentProviderIds: ["manual"],
      automaticTaxes: true,
      isTaxInclusive: false,
    })
    expect(settings.salesChannels[0]).toEqual({
      id: "sc_1",
      name: "Web",
      description: "Primary storefront",
      isDisabled: false,
      createdAt: "2026-06-02T00:00:00.000Z",
    })
    expect(settings.apiKeys[0]).toEqual({
      id: "apk_1",
      title: "Publishable",
      type: "publishable",
      redacted: "pk_...",
      revokedAt: null,
      createdAt: "2026-06-03T00:00:00.000Z",
    })
    expect(settings.featureFlags[0]).toEqual({
      key: "inventory",
      name: "Inventory",
      enabled: true,
      value: "on",
    })
    expect(settings.plugins[0]).toEqual({
      name: "payment-manual",
      version: "1.0.0",
      resolve: "@local/payment-manual",
      options: { enabled: true },
    })
    expect(settings.stores[0]).not.toHaveProperty("default_region_id")
    expect(settings.stores[0].supportedCurrencies[0]).not.toHaveProperty(
      "currency_code",
    )
    expect(settings.users[0]).not.toHaveProperty("first_name")
    expect(settings.regions[0].countries[0]).not.toHaveProperty("iso_2")
    expect(settings.salesChannels[0]).not.toHaveProperty("is_disabled")
    expect(settings.apiKeys[0]).not.toHaveProperty("revoked_at")
  })

  it("maps system setting writes from product input to current backend bodies", async () => {
    adminApiMock.mockResolvedValue({ ok: true })

    await updateStoreName({ storeId: "store_1", name: "Main store" })

    expect(adminApiMock).toHaveBeenCalledWith("/admin/stores/store_1", {
      method: "POST",
      body: { name: "Main store" },
    })

    await createSalesChannel({
      name: "Wholesale",
      description: "",
      isDisabled: true,
    })

    expect(adminApiMock).toHaveBeenLastCalledWith("/admin/sales-channels", {
      method: "POST",
      body: {
        name: "Wholesale",
        description: null,
        is_disabled: true,
      },
    })
  })

  it("maps AI provider, policy, and run responses to product-admin DTOs", async () => {
    adminApiMock.mockImplementation(async (path: string) => {
      if (path === "/admin/ai/providers") {
        return {
          enabled: true,
          default_provider_code: "openai",
          providers: [
            {
              code: "openai",
              label: "OpenAI",
              provider_kind: "llm",
              protocol: "responses",
              base_url: "https://api.openai.com",
              default_model: "gpt-5.1",
              capabilities: ["text.generate"],
              api_key_env: "OPENAI_API_KEY",
              api_key_configured: true,
              requires_api_key: true,
              enabled: true,
              status: "ready",
              issues: [],
            },
          ],
          task_plugins: [
            {
              code: "seo-suggest",
              task_type: "seo_suggest",
              title: "SEO suggest",
              required_capabilities: ["text.generate"],
              requires_human_review: true,
              runnable: true,
            },
          ],
          task_runs: [
            {
              id: "run_1",
              task_type: "seo_suggest",
              plugin_code: "seo-suggest",
              provider_code: "openai",
              site_id: "global",
              status: "completed",
              input_summary: "Suggest title",
              output_summary: "Done",
              error_message: null,
              created_at: "2026-06-13T00:00:00.000Z",
            },
          ],
          issues: [],
          summary: {
            provider_count: 1,
            configured_provider_count: 1,
            attention_provider_count: 0,
            review_run_count: 0,
          },
        }
      }

      if (path === "/admin/ai/control-panel-policy") {
        return {
          policy: {
            version: "1.0.0",
            purpose: "AI control panel",
            admissionCriteria: [
              {
                id: "configured",
                title: "Configured",
                description: "Provider configured",
              },
            ],
            requiredSurface: [
              {
                id: "runs",
                title: "Runs",
                description: "Shows task runs",
              },
            ],
          },
        }
      }

      if (path === "/admin/ai/runs?limit=50") {
        return {
          runs: [
            {
              id: "run_2",
              task_type: "content_review",
              plugin_code: "content-review",
              provider_code: null,
              site_id: "global",
              status: "pending_review",
              input_summary: "Review content",
              output_summary: null,
              error_message: "Needs reviewer",
              created_at: "2026-06-14T00:00:00.000Z",
            },
          ],
        }
      }

      throw new Error(`Unexpected path: ${path}`)
    })

    const providers = await loadAIProviders()
    const policy = await loadAIPolicy()
    const runs = await loadAIRuns()

    expect(providers).toMatchObject({
      enabled: true,
      defaultProviderCode: "openai",
      summary: {
        providerCount: 1,
        configuredProviderCount: 1,
        attentionProviderCount: 0,
        reviewRunCount: 0,
      },
    })
    expect(providers.providers[0]).toMatchObject({
      code: "openai",
      providerKind: "llm",
      baseUrl: "https://api.openai.com",
      defaultModel: "gpt-5.1",
      apiKeyEnv: "OPENAI_API_KEY",
      apiKeyConfigured: true,
      requiresApiKey: true,
    })
    expect(providers.taskPlugins[0]).toMatchObject({
      taskType: "seo_suggest",
      requiredCapabilities: ["text.generate"],
      requiresHumanReview: true,
    })
    expect(providers.taskRuns[0]).toMatchObject({
      taskType: "seo_suggest",
      pluginCode: "seo-suggest",
      providerCode: "openai",
      siteId: "global",
      inputSummary: "Suggest title",
      outputSummary: "Done",
      createdAt: "2026-06-13T00:00:00.000Z",
    })
    expect(policy.policy.admissionCriteria[0]).toMatchObject({
      id: "configured",
      title: "Configured",
    })
    expect(runs.runs[0]).toMatchObject({
      taskType: "content_review",
      pluginCode: "content-review",
      providerCode: null,
      errorMessage: "Needs reviewer",
      createdAt: "2026-06-14T00:00:00.000Z",
    })
    expect(providers).not.toHaveProperty("default_provider_code")
    expect(providers.providers[0]).not.toHaveProperty("provider_kind")
    expect(providers.taskPlugins[0]).not.toHaveProperty("task_type")
    expect(runs.runs[0]).not.toHaveProperty("error_message")
  })

  it("maps ops dashboard responses to product-admin DTOs", async () => {
    const rawSection = {
      status: "warning",
      summary: { configured: 1 },
      settings: [
        {
          key: "backup.enabled",
          label: "Backup enabled",
          owner: "ops",
          scope: "production",
          configured: true,
          secret: false,
          value: true,
          recommended: true,
          status: "ok",
          notes: "ready",
        },
      ],
      findings: [
        {
          id: "finding_1",
          severity: "warning",
          owner: "ops",
          title: "Backup drill due",
          detail: "Run restore drill",
          recommended_action: "Run restore drill",
          human_gate: true,
        },
      ],
    }

    adminApiMock.mockImplementation(async (path: string) => {
      if (path === "/admin/ops-control/dashboard") {
        return {
          generated_at: "2026-06-15T00:00:00.000Z",
          summary: {
            status: "warning",
            critical_findings: 1,
            warning_findings: 2,
            human_gate_actions: 1,
            control_panel_surface_count: 5,
            gated_surface_count: 4,
          },
          launch_readiness: rawSection,
          security: rawSection,
          maintenance: rawSection,
          customer: rawSection,
          commerce: rawSection,
          ai_ops: rawSection,
          findings: rawSection.findings,
        }
      }

      if (path === "/admin/ops-control/security") {
        return { security: rawSection }
      }

      if (path === "/admin/ops-control/maintenance") {
        return {
          maintenance: rawSection,
          customer: rawSection,
          commerce: rawSection,
          ai_ops: rawSection,
        }
      }

      throw new Error(`Unexpected path: ${path}`)
    })

    const dashboard = await loadOpsDashboard()
    const security = await loadOpsSecurity()
    const maintenance = await loadOpsMaintenance()

    expect(dashboard).toMatchObject({
      generatedAt: "2026-06-15T00:00:00.000Z",
      summary: {
        status: "warning",
        criticalFindings: 1,
        warningFindings: 2,
        humanGateActions: 1,
        controlPanelSurfaceCount: 5,
        gatedSurfaceCount: 4,
      },
    })
    expect(dashboard.launchReadiness.findings[0]).toMatchObject({
      recommendedAction: "Run restore drill",
      humanGate: true,
    })
    expect(dashboard.aiOps.settings[0]).toMatchObject({
      key: "backup.enabled",
      recommended: true,
      notes: "ready",
    })
    expect(security.security.findings[0]).toMatchObject({
      recommendedAction: "Run restore drill",
      humanGate: true,
    })
    expect(maintenance.aiOps.status).toBe("warning")
    expect(dashboard).not.toHaveProperty("generated_at")
    expect(dashboard.summary).not.toHaveProperty("critical_findings")
    expect(dashboard.launchReadiness.findings[0]).not.toHaveProperty(
      "human_gate",
    )
  })

  it("maps marketing workspace responses to product-admin DTOs", async () => {
    adminApiMock.mockImplementation(async (path: string) => {
      if (path === "/admin/marketing/campaigns?limit=50") {
        return {
          campaigns: [
            {
              id: "campaign_1",
              code: "SUMMER_2026",
              name: "Summer 2026",
              status: "active",
              starts_at: "2026-06-01T00:00:00.000Z",
              ends_at: "2026-06-30T00:00:00.000Z",
              created_at: "2026-05-20T00:00:00.000Z",
            },
          ],
        }
      }

      if (path === "/admin/marketing/offers?limit=50") {
        return {
          offers: [
            {
              id: "offer_1",
              code: "BUNDLE_10",
              name: "Bundle discount",
              type: "bundle",
              status: "active",
              priority: 20,
              created_at: "2026-05-21T00:00:00.000Z",
            },
          ],
        }
      }

      if (path === "/admin/marketing/coupons?limit=50") {
        return {
          coupons: [
            {
              id: "coupon_1",
              code: "SAVE10",
              status: "active",
              discount_type: "percentage",
              discount_value: 10,
              max_redemptions: 100,
              max_redemptions_per_email: 1,
              redeemed_count: 7,
              expires_at: "2026-07-01T00:00:00.000Z",
              created_at: "2026-05-22T00:00:00.000Z",
            },
          ],
        }
      }

      if (path === "/admin/marketing/referral-links?limit=50") {
        return {
          referral_links: [
            {
              id: "ref_1",
              code: "CREATOR_A",
              status: "active",
              referrer_email: "creator@example.com",
              max_uses: 50,
              used_count: 5,
              created_at: "2026-05-23T00:00:00.000Z",
            },
          ],
        }
      }

      if (path === "/admin/marketing/touchpoints?limit=100") {
        return {
          touchpoints: [
            {
              id: "touch_1",
              event_name: "checkout.started",
              payment_attempt_id: "payatt_1",
              order_id: "order_1",
              coupon_code: "SAVE10",
              referral_code: "CREATOR_A",
              source: "newsletter",
              medium: "email",
              campaign: "SUMMER_2026",
              created_at: "2026-05-24T00:00:00.000Z",
            },
          ],
        }
      }

      throw new Error(`Unexpected path: ${path}`)
    })

    const workspace = await loadMarketingWorkspace()

    expect(workspace.campaigns[0]).toEqual({
      id: "campaign_1",
      code: "SUMMER_2026",
      name: "Summer 2026",
      status: "active",
      startsAt: "2026-06-01T00:00:00.000Z",
      endsAt: "2026-06-30T00:00:00.000Z",
      createdAt: "2026-05-20T00:00:00.000Z",
    })
    expect(workspace.offers[0]).toEqual({
      id: "offer_1",
      code: "BUNDLE_10",
      name: "Bundle discount",
      type: "bundle",
      status: "active",
      priority: 20,
      createdAt: "2026-05-21T00:00:00.000Z",
    })
    expect(workspace.coupons[0]).toEqual({
      id: "coupon_1",
      code: "SAVE10",
      status: "active",
      discountType: "percentage",
      discountValue: 10,
      maxRedemptions: 100,
      maxRedemptionsPerEmail: 1,
      redeemedCount: 7,
      expiresAt: "2026-07-01T00:00:00.000Z",
      createdAt: "2026-05-22T00:00:00.000Z",
    })
    expect(workspace.referralLinks[0]).toEqual({
      id: "ref_1",
      code: "CREATOR_A",
      status: "active",
      referrerEmail: "creator@example.com",
      maxUses: 50,
      usedCount: 5,
      createdAt: "2026-05-23T00:00:00.000Z",
    })
    expect(workspace.touchpoints[0]).toEqual({
      id: "touch_1",
      eventName: "checkout.started",
      paymentAttemptId: "payatt_1",
      orderId: "order_1",
      couponCode: "SAVE10",
      referralCode: "CREATOR_A",
      source: "newsletter",
      medium: "email",
      campaign: "SUMMER_2026",
      createdAt: "2026-05-24T00:00:00.000Z",
    })
    expect(workspace.campaigns[0]).not.toHaveProperty("starts_at")
    expect(workspace.coupons[0]).not.toHaveProperty("redeemed_count")
    expect(workspace.referralLinks[0]).not.toHaveProperty("referrer_email")
    expect(workspace.touchpoints[0]).not.toHaveProperty("event_name")
  })

  it("maps marketing writes from product input to current backend bodies", async () => {
    adminApiMock.mockResolvedValue({ ok: true })

    await createMarketingCampaign({
      code: " SUMMER_2026 ",
      name: " Summer 2026 ",
      status: "draft",
    })

    expect(adminApiMock).toHaveBeenCalledWith("/admin/marketing/campaigns", {
      method: "POST",
      body: {
        code: "SUMMER_2026",
        name: "Summer 2026",
        status: "draft",
      },
    })

    await createMarketingCoupon({
      code: " SAVE10 ",
      status: "active",
      maxRedemptions: "100",
    })

    expect(adminApiMock).toHaveBeenLastCalledWith("/admin/marketing/coupons", {
      method: "POST",
      body: {
        code: "SAVE10",
        status: "active",
        max_redemptions: 100,
      },
    })

    await createMarketingReferral({
      code: " CREATOR_A ",
      referrerEmail: "creator@example.com",
      maxUses: "50",
    })

    expect(adminApiMock).toHaveBeenLastCalledWith(
      "/admin/marketing/referral-links",
      {
        method: "POST",
        body: {
          code: "CREATOR_A",
          referrer_email: "creator@example.com",
          max_uses: 50,
          status: "active",
        },
      },
    )
  })

  it("maps payment workspace responses to product-admin DTOs", async () => {
    adminApiMock.mockImplementation(async (path: string) => {
      if (path === "/admin/payment-channels") {
        return {
          channels: [
            {
              id: "paychan_1",
              code: "manual",
              display_name: "Manual payment",
              type: "manual",
              enabled: true,
              priority: 10,
              provider_code: "manual",
              health_status: "healthy",
            },
          ],
        }
      }

      if (path === "/admin/payment-attempts?limit=100") {
        return {
          attempts: [
            {
              id: "payatt_1",
              cart_id: "cart_1",
              provider_code: "manual",
              provider_order_id: "manual_1",
              amount: 1999,
              currency: "usd",
              status: "pending",
              paid_at: null,
              created_at: "2026-06-05T00:00:00.000Z",
            },
          ],
        }
      }

      throw new Error(`Unexpected path: ${path}`)
    })

    const workspace = await loadPaymentWorkspace()

    expect(workspace.channels[0]).toEqual({
      id: "paychan_1",
      code: "manual",
      displayName: "Manual payment",
      type: "manual",
      enabled: true,
      priority: 10,
      providerCode: "manual",
      healthStatus: "healthy",
    })
    expect(workspace.attempts[0]).toEqual({
      id: "payatt_1",
      cartId: "cart_1",
      providerCode: "manual",
      providerOrderId: "manual_1",
      amount: 1999,
      currency: "usd",
      status: "pending",
      paidAt: null,
      createdAt: "2026-06-05T00:00:00.000Z",
    })
    expect(workspace.channels[0]).not.toHaveProperty("provider_code")
    expect(workspace.attempts[0]).not.toHaveProperty("provider_order_id")
  })

  it("maps payment channel toggles from product input to current backend body", async () => {
    adminApiMock.mockResolvedValue({ channel: { id: "paychan_1" } })

    await togglePaymentChannel({
      id: "paychan_1",
      enabled: true,
    })

    expect(adminApiMock).toHaveBeenCalledWith("/admin/payment-channels/paychan_1", {
      method: "POST",
      body: {
        enabled: false,
      },
    })
  })

  it("maps delivery workspace responses to product-admin DTOs", async () => {
    adminApiMock.mockImplementation(async (path: string) => {
      if (path === "/admin/digital-delivery/pending") {
        return {
          items: [
            {
              kind: "credential",
              id: "acct_item_1",
              delivery_id: null,
              display_label: "Card 1",
              account_identifier: "CARD-1",
              product_variant_id: "variant_1",
              cart_id: "cart_1",
              order_id: "order_1",
              payment_attempt_id: "payatt_1",
            },
          ],
        }
      }

      if (path === "/admin/digital-delivery/deliveries") {
        return {
          deliveries: [
            {
              id: "delivery_1",
              delivery_status: "delivered",
              account_item_id: "acct_item_1",
              cart_id: "cart_1",
              payment_attempt_id: "payatt_1",
              access_token_hint: "tok_...",
              delivered_by: "admin",
              delivered_at: "2026-06-06T00:00:00.000Z",
              buyer_confirmed_at: null,
            },
          ],
        }
      }

      throw new Error(`Unexpected path: ${path}`)
    })

    const workspace = await loadDeliveryWorkspace()

    expect(workspace.pending[0]).toEqual({
      kind: "credential",
      id: "acct_item_1",
      deliveryId: null,
      displayLabel: "Card 1",
      accountIdentifier: "CARD-1",
      productVariantId: "variant_1",
      cartId: "cart_1",
      orderId: "order_1",
      paymentAttemptId: "payatt_1",
    })
    expect(workspace.deliveries[0]).toEqual({
      id: "delivery_1",
      status: "delivered",
      accountItemId: "acct_item_1",
      cartId: "cart_1",
      paymentAttemptId: "payatt_1",
      accessTokenHint: "tok_...",
      deliveredBy: "admin",
      deliveredAt: "2026-06-06T00:00:00.000Z",
      buyerConfirmedAt: null,
    })
    expect(workspace.pending[0]).not.toHaveProperty("account_item_id")
    expect(workspace.deliveries[0]).not.toHaveProperty("delivery_status")
  })

  it("maps delivery creation from product input to current backend body", async () => {
    adminApiMock.mockResolvedValue({
      delivery: {
        id: "delivery_1",
        delivery_status: "delivered",
        account_item_id: "acct_item_1",
      },
      accessToken: "delivery_token",
    })

    const result = await createDigitalDelivery({
      deliveryId: "delivery_1",
      accountItemId: "acct_item_1",
      orderId: "order_1",
      cartId: "cart_1",
      paymentAttemptId: "payatt_1",
      deliveredBy: "operator",
      deliveryNote: "Checked",
      deliveryPayload: { code: "SECRET" },
    })

    expect(result).toEqual({
      delivery: {
        id: "delivery_1",
        status: "delivered",
        accountItemId: "acct_item_1",
        cartId: null,
        paymentAttemptId: null,
        accessTokenHint: null,
        deliveredBy: null,
        deliveredAt: null,
        buyerConfirmedAt: null,
      },
      accessToken: "delivery_token",
    })
    expect(adminApiMock).toHaveBeenCalledWith(
      "/admin/digital-delivery/deliveries",
      {
        method: "POST",
        body: {
          delivery_id: "delivery_1",
          account_item_id: "acct_item_1",
          order_id: "order_1",
          cart_id: "cart_1",
          payment_attempt_id: "payatt_1",
          delivery_payload: { code: "SECRET" },
          delivered_by: "operator",
          delivery_note: "Checked",
        },
      },
    )
  })

  it("maps after-sales responses to product-admin DTOs", async () => {
    adminApiMock.mockResolvedValue({
      after_sales: [
        {
          id: "as_1",
          delivery_id: "delivery_1",
          customer_email: "buyer@example.com",
          reason: "not_working",
          message: "Code failed",
          status: "open",
          result: "pending",
          admin_note: null,
          created_at: "2026-06-07T00:00:00.000Z",
        },
      ],
    })

    const items = await loadAfterSales()

    expect(items[0]).toEqual({
      id: "as_1",
      deliveryId: "delivery_1",
      customerEmail: "buyer@example.com",
      reason: "not_working",
      message: "Code failed",
      status: "open",
      result: "pending",
      adminNote: null,
      createdAt: "2026-06-07T00:00:00.000Z",
    })
    expect(items[0]).not.toHaveProperty("delivery_id")
    expect(items[0]).not.toHaveProperty("customer_email")
  })

  it("maps supplier workspace responses to product-admin DTOs", async () => {
    adminApiMock.mockImplementation(async (path: string) => {
      if (path === "/admin/suppliers/providers") {
        return {
          providers: [
            {
              code: "reloadly",
              configured: true,
              supports_quote: true,
              supports_retrieve: false,
              supports_catalog_sync: true,
            },
          ],
        }
      }

      if (path === "/admin/suppliers/mappings?limit=100") {
        return {
          mappings: [
            {
              id: "mapping_1",
              product_variant_id: "variant_1",
              provider_code: "reloadly",
              provider_sku: "sku_1",
              provider_product_id: "prod_1",
              region_code: "US",
              currency: "usd",
              enabled: true,
              priority: 10,
            },
          ],
        }
      }

      if (path === "/admin/suppliers/procurements?limit=100") {
        return {
          procurements: [
            {
              id: "proc_1",
              provider_code: "reloadly",
              provider_order_id: "po_1",
              status: "failed",
              product_variant_id: "variant_1",
              order_id: "order_1",
              payment_attempt_id: "payatt_1",
              error_message: "Provider rejected",
              fulfilled_at: null,
              created_at: "2026-06-08T00:00:00.000Z",
            },
          ],
        }
      }

      throw new Error(`Unexpected path: ${path}`)
    })

    const workspace = await loadSupplierWorkspace()

    expect(workspace.providers[0]).toEqual({
      code: "reloadly",
      configured: true,
      supportsQuote: true,
      supportsRetrieve: false,
      supportsCatalogSync: true,
    })
    expect(workspace.mappings[0]).toEqual({
      id: "mapping_1",
      productVariantId: "variant_1",
      providerCode: "reloadly",
      providerSku: "sku_1",
      providerProductId: "prod_1",
      regionCode: "US",
      currency: "usd",
      enabled: true,
      priority: 10,
    })
    expect(workspace.procurements[0]).toEqual({
      id: "proc_1",
      providerCode: "reloadly",
      providerOrderId: "po_1",
      status: "failed",
      productVariantId: "variant_1",
      orderId: "order_1",
      paymentAttemptId: "payatt_1",
      errorMessage: "Provider rejected",
      fulfilledAt: null,
      createdAt: "2026-06-08T00:00:00.000Z",
    })
    expect(workspace.providers[0]).not.toHaveProperty("supports_quote")
    expect(workspace.mappings[0]).not.toHaveProperty("product_variant_id")
    expect(workspace.procurements[0]).not.toHaveProperty("provider_order_id")
  })

  it("maps supplier mapping saves from product input to current backend body", async () => {
    adminApiMock.mockResolvedValue({
      mapping: {
        id: "mapping_1",
        product_variant_id: "variant_1",
        provider_code: "reloadly",
        provider_sku: "sku_1",
        priority: 100,
        enabled: true,
      },
    })

    const result = await saveSupplierMapping({
      productVariantId: "variant_1",
      providerCode: "reloadly",
      providerSku: "sku_1",
      providerProductId: "prod_1",
      regionCode: "US",
      currency: "usd",
      priority: "10",
      metadata: "{\"deliveryHint\":\"instant\"}",
    })

    expect(result.mapping).toMatchObject({
      id: "mapping_1",
      productVariantId: "variant_1",
      providerCode: "reloadly",
      providerSku: "sku_1",
      enabled: true,
    })
    expect(adminApiMock).toHaveBeenCalledWith("/admin/suppliers/mappings", {
      method: "POST",
      body: {
        product_variant_id: "variant_1",
        provider_code: "reloadly",
        provider_sku: "sku_1",
        provider_product_id: "prod_1",
        region_code: "US",
        currency: "usd",
        enabled: true,
        priority: 10,
        metadata: {
          deliveryHint: "instant",
        },
      },
    })
  })

  it("maps content workspace responses to product-admin DTOs", async () => {
    adminApiMock.mockImplementation(async (path: string) => {
      if (path === "/admin/content/entries?limit=100&site_id=site-1&status=published") {
        return {
          entries: [
            {
              id: "entry_1",
              site_id: "site-1",
              slug: "buying-guide",
              title: "Buying guide",
              excerpt: "Short summary",
              body: "Long body",
              content_format: "markdown",
              content_type: "guide",
              status: "published",
              language: "en",
              cover_image_url: "https://example.com/cover.png",
              audio_url: "https://example.com/audio.mp3",
              reading_time_minutes: 4,
              word_count: 900,
            },
          ],
        }
      }

      if (path === "/admin/content/storage/providers") {
        return {
          default_provider_code: "r2-main",
          providers: [
            {
              code: "r2-main",
              label: "R2 main",
              kind: "r2",
              bucket: "content-assets",
              upload_strategy: "direct",
              status: "ready",
              issues: ["rotate key soon"],
            },
          ],
          issues: ["storage warning"],
        }
      }

      if (path === "/admin/content/assets?limit=25") {
        return {
          assets: [
            {
              id: "asset_1",
              site_id: "site-1",
              entry_id: "entry_1",
              asset_type: "audio",
              storage_provider: "r2",
              storage_provider_code: "r2-main",
              public_url: "https://example.com/audio.mp3",
              object_key: "site-1/content/audio.mp3",
            },
          ],
        }
      }

      if (path === "/admin/content/audio?limit=25") {
        return {
          audio: [
            {
              id: "audio_1",
              entry_id: "entry_1",
              status: "ready",
              provider_code: "openai",
              model: "tts-1",
              voice: "alloy",
              created_at: "2026-06-16T00:00:00.000Z",
            },
          ],
        }
      }

      if (path === "/admin/content/ai/tasks?limit=25") {
        return {
          tasks: [
            {
              id: "task_1",
              task_type: "tts",
              provider_code: "openai",
              provider_capability: "speech.tts",
              status: "queued",
              review_status: "pending",
              created_at: "2026-06-17T00:00:00.000Z",
            },
          ],
        }
      }

      throw new Error(`Unexpected path: ${path}`)
    })

    const workspace = await loadContentWorkspace({
      siteId: "site-1",
      status: "published",
    })

    expect(workspace.entries[0]).toEqual({
      id: "entry_1",
      siteId: "site-1",
      slug: "buying-guide",
      title: "Buying guide",
      excerpt: "Short summary",
      body: "Long body",
      contentFormat: "markdown",
      contentType: "guide",
      status: "published",
      language: "en",
      coverImageUrl: "https://example.com/cover.png",
      audioUrl: "https://example.com/audio.mp3",
      readingTimeMinutes: 4,
      wordCount: 900,
    })
    expect(workspace.storage).toEqual({
      defaultProviderCode: "r2-main",
      providers: [
        {
          code: "r2-main",
          label: "R2 main",
          kind: "r2",
          bucket: "content-assets",
          uploadStrategy: "direct",
          status: "ready",
          issues: ["rotate key soon"],
        },
      ],
      issues: ["storage warning"],
    })
    expect(workspace.assets[0]).toEqual({
      id: "asset_1",
      siteId: "site-1",
      entryId: "entry_1",
      assetType: "audio",
      storageProvider: "r2",
      storageProviderCode: "r2-main",
      publicUrl: "https://example.com/audio.mp3",
      objectKey: "site-1/content/audio.mp3",
    })
    expect(workspace.audio[0]).toEqual({
      id: "audio_1",
      entryId: "entry_1",
      status: "ready",
      providerCode: "openai",
      model: "tts-1",
      voice: "alloy",
      createdAt: "2026-06-16T00:00:00.000Z",
    })
    expect(workspace.tasks[0]).toEqual({
      id: "task_1",
      taskType: "tts",
      providerCode: "openai",
      providerCapability: "speech.tts",
      status: "queued",
      reviewStatus: "pending",
      createdAt: "2026-06-17T00:00:00.000Z",
    })
    expect(workspace.entries[0]).not.toHaveProperty("site_id")
    expect(workspace.storage).not.toHaveProperty("default_provider_code")
    expect(workspace.storage.providers[0]).not.toHaveProperty("upload_strategy")
    expect(workspace.assets[0]).not.toHaveProperty("entry_id")
    expect(workspace.audio[0]).not.toHaveProperty("provider_code")
    expect(workspace.tasks[0]).not.toHaveProperty("task_type")
  })

  it("maps content writes from product input to current backend bodies", async () => {
    adminApiMock.mockResolvedValue({ ok: true })

    await createContentEntry({
      siteId: "site-1",
      title: "Buying guide",
      slug: "",
      excerpt: "Summary",
      body: "Body",
      contentFormat: "markdown",
      contentType: "guide",
      status: "draft",
      authorName: "Editor",
      coverImageUrl: "https://example.com/cover.png",
      language: "en",
      topic: "games",
      tags: "gift,cards",
      relatedProductHandles: "gift-card",
      aiAssisted: true,
    })

    expect(adminApiMock).toHaveBeenCalledWith("/admin/content/entries", {
      method: "POST",
      body: {
        site_id: "site-1",
        title: "Buying guide",
        slug: "buying-guide",
        excerpt: "Summary",
        body: "Body",
        content_format: "markdown",
        content_type: "guide",
        status: "draft",
        author_name: "Editor",
        cover_image_url: "https://example.com/cover.png",
        language: "en",
        topic: "games",
        tags: "gift,cards",
        related_product_handles: "gift-card",
        ai_assisted: true,
      },
    })

    await createContentAsset({
      form: {
        siteId: "site-1",
        entryId: "entry_1",
        assetType: "audio",
        storageProviderCode: "r2-main",
        filename: "audio.mp3",
        publicUrl: "https://example.com/audio.mp3",
        objectKey: "site-1/content/audio.mp3",
        mimeType: "audio/mpeg",
        altText: "Audio version",
      },
      provider: {
        code: "r2-main",
        label: "R2 main",
        kind: "r2",
        bucket: "content-assets",
        uploadStrategy: "direct",
        status: "ready",
        issues: [],
      },
    })

    expect(adminApiMock).toHaveBeenLastCalledWith("/admin/content/assets", {
      method: "POST",
      body: {
        site_id: "site-1",
        entry_id: "entry_1",
        asset_type: "audio",
        storage_provider: "r2",
        storage_provider_code: "r2-main",
        public_url: "https://example.com/audio.mp3",
        object_key: "site-1/content/audio.mp3",
        mime_type: "audio/mpeg",
        alt_text: "Audio version",
      },
    })

    await createContentUploadPolicy({
      siteId: "site-1",
      entryId: "entry_1",
      assetType: "cover_image",
      storageProviderCode: "r2-main",
      filename: "cover.png",
      publicUrl: "",
      objectKey: "",
      mimeType: "image/png",
      altText: "",
    })

    expect(adminApiMock).toHaveBeenLastCalledWith(
      "/admin/content/assets/upload-policy",
      {
        method: "POST",
        body: {
          site_id: "site-1",
          entry_id: "entry_1",
          asset_type: "cover_image",
          storage_provider_code: "r2-main",
          filename: "cover.png",
          mime_type: "image/png",
          expires_in_seconds: 900,
        },
      },
    )

    await createContentAiTask({
      siteId: "site-1",
      entryId: "entry_1",
      taskType: "summary",
      providerCapability: "",
      providerCode: "openai",
      model: "gpt-5.1",
      inputSummary: "Summarize article",
    })

    expect(adminApiMock).toHaveBeenLastCalledWith("/admin/content/ai/tasks", {
      method: "POST",
      body: {
        site_id: "site-1",
        entry_id: "entry_1",
        task_type: "summary",
        provider_code: "openai",
        provider_capability: "text.generate",
        model: "gpt-5.1",
        status: "queued",
        review_status: "pending",
        input_summary: "Summarize article",
      },
    })

    await runContentAiTask({
      siteId: "site-1",
      entryId: "entry_1",
      taskType: "tts",
      providerCapability: "speech.tts",
      providerCode: "openai",
      model: "tts-1",
      inputSummary: "Narrate article",
    })

    expect(adminApiMock).toHaveBeenLastCalledWith("/admin/content/ai/run", {
      method: "POST",
      body: {
        site_id: "site-1",
        entry_id: "entry_1",
        task_type: "tts",
        provider_code: "openai",
        model: "tts-1",
        input_summary: "Narrate article",
        input: { source: "admin_content_view" },
      },
    })

    await updateContentEntryStatus({ id: "entry_1", status: "review" })

    expect(adminApiMock).toHaveBeenLastCalledWith(
      "/admin/content/entries/entry_1",
      {
        method: "POST",
        body: { status: "review" },
      },
    )
  })

  it("maps content row actions from product DTOs to current backend bodies", async () => {
    adminApiMock.mockImplementation(async (path: string) => {
      if (path === "/admin/content/entries/entry_1/revisions") {
        return { revision: { id: "revision_1" } }
      }

      return { ok: true }
    })

    await publishContentEntrySnapshot({ id: "entry_1" })

    expect(adminApiMock).toHaveBeenNthCalledWith(
      1,
      "/admin/content/entries/entry_1/revisions",
      {
        method: "POST",
        body: { status: "review", change_note: "Admin publish snapshot" },
      },
    )
    expect(adminApiMock).toHaveBeenNthCalledWith(
      2,
      "/admin/content/revisions/revision_1/publish",
      {
        method: "POST",
        body: { channel: "storefront" },
      },
    )

    await queueContentEntryTask({
      entry: {
        id: "entry_1",
        siteId: "site-1",
        slug: "buying-guide",
        title: "Buying guide",
        excerpt: null,
        body: null,
        contentFormat: "markdown",
        contentType: "guide",
        status: "published",
        language: "en",
        coverImageUrl: null,
        audioUrl: null,
        readingTimeMinutes: null,
        wordCount: null,
      },
      taskType: "tts",
    })

    expect(adminApiMock).toHaveBeenLastCalledWith("/admin/content/ai/tasks", {
      method: "POST",
      body: {
        site_id: "site-1",
        entry_id: "entry_1",
        task_type: "tts",
        provider_capability: "speech.tts",
        status: "queued",
        review_status: "pending",
        input_summary: "tts: Buying guide",
      },
    })

    await registerContentAudioFromAsset({
      id: "asset_1",
      siteId: "site-1",
      entryId: "entry_1",
      assetType: "audio",
      storageProvider: "r2",
      storageProviderCode: "r2-main",
      publicUrl: "https://example.com/audio.mp3",
      objectKey: "site-1/content/audio.mp3",
    })

    expect(adminApiMock).toHaveBeenNthCalledWith(
      4,
      "/admin/content/audio",
      {
        method: "POST",
        body: {
          site_id: "site-1",
          entry_id: "entry_1",
          asset_id: "asset_1",
          status: "ready",
          metadata: { source: "admin_asset_registration" },
        },
      },
    )
    expect(adminApiMock).toHaveBeenNthCalledWith(
      5,
      "/admin/content/entries/entry_1",
      {
        method: "POST",
        body: { audio_asset_id: "asset_1" },
      },
    )

    await updateContentTaskReview({
      taskId: "task_1",
      reviewStatus: "approved",
    })

    expect(adminApiMock).toHaveBeenLastCalledWith(
      "/admin/content/ai/tasks/task_1",
      {
        method: "POST",
        body: {
          review_status: "approved",
          output_summary: "Admin review marked approved",
        },
      },
    )
  })

  it("maps SEO workspace responses to product-admin DTOs", async () => {
    adminApiMock.mockImplementation(async (path: string) => {
      if (path === "/admin/content/seo?limit=200") {
        return {
          documents: [
            {
              id: "seo_1",
              entity_type: "product",
              entity_id: "prod_1",
              site_id: "global",
              language: "en",
              meta_title: "Gift card",
              meta_description: "Buy gift cards",
              canonical_url: "https://example.com/gift-card",
              og_image_url: "https://example.com/og.png",
              status: "published",
              updated_at: "2026-06-09T00:00:00.000Z",
            },
          ],
        }
      }

      if (path === "/admin/content/seo/audit") {
        return {
          summary: {
            documents: 1,
            critical: 0,
            warning: 1,
            info: 0,
            average_score: 92,
          },
          results: [
            {
              id: "seo_1",
              entity_type: "product",
              entity_id: "prod_1",
              score: 92,
              findings: [
                {
                  id: "finding_1",
                  severity: "warning",
                  field: "metaTitle",
                  message: "Short title",
                },
              ],
            },
          ],
          performance_joined: true,
        }
      }

      throw new Error(`Unexpected path: ${path}`)
    })

    const workspace = await loadSeoWorkspace()

    expect(workspace.documents[0]).toEqual({
      id: "seo_1",
      entityType: "product",
      entityId: "prod_1",
      siteId: "global",
      language: "en",
      metaTitle: "Gift card",
      metaDescription: "Buy gift cards",
      canonicalUrl: "https://example.com/gift-card",
      ogImageUrl: "https://example.com/og.png",
      status: "published",
      updatedAt: "2026-06-09T00:00:00.000Z",
    })
    expect(workspace.audit).toEqual({
      summary: {
        documents: 1,
        critical: 0,
        warning: 1,
        info: 0,
        averageScore: 92,
      },
      results: [
        {
          id: "seo_1",
          entityType: "product",
          entityId: "prod_1",
          score: 92,
          findings: [
            {
              id: "finding_1",
              severity: "warning",
              field: "metaTitle",
              message: "Short title",
            },
          ],
        },
      ],
      performanceJoined: true,
    })
    expect(workspace.documents[0]).not.toHaveProperty("entity_type")
    expect(workspace.audit.summary).not.toHaveProperty("average_score")
  })

  it("maps SEO performance responses to product-admin DTOs", async () => {
    adminApiMock.mockResolvedValue({
      config: {
        status: "configured",
        site_url: "https://example.com",
      },
      performance: {
        configured: true,
        status: "ready",
        site_url: "https://example.com",
        rows: [{ page: "/gift-card", clicks: 10, impressions: 100 }],
      },
    })

    const performance = await loadSeoPerformance()

    expect(performance).toEqual({
      config: {
        status: "configured",
        siteUrl: "https://example.com",
      },
      performance: {
        configured: true,
        status: "ready",
        siteUrl: "https://example.com",
        rows: [{ page: "/gift-card", clicks: 10, impressions: 100 }],
      },
    })
    expect(performance.config).not.toHaveProperty("site_url")
    expect(performance.performance).not.toHaveProperty("site_url")
  })

  it("maps SEO writes from product input to current backend bodies", async () => {
    adminApiMock.mockResolvedValue({ document: { id: "seo_1" } })

    await upsertSeoDocument({
      entityType: "product",
      entityId: "prod_1",
      siteId: "global",
      language: "en",
      metaTitle: "Gift card",
      metaDescription: "Buy gift cards",
      canonicalUrl: "https://example.com/gift-card",
      ogImageUrl: "https://example.com/og.png",
      status: "published",
    })

    expect(adminApiMock).toHaveBeenCalledWith("/admin/content/seo", {
      method: "POST",
      body: {
        entity_type: "product",
        entity_id: "prod_1",
        site_id: "global",
        language: "en",
        meta_title: "Gift card",
        meta_description: "Buy gift cards",
        canonical_url: "https://example.com/gift-card",
        og_image_url: "https://example.com/og.png",
        status: "published",
      },
    })

    await suggestSeoDocument({
      entityType: "product",
      entityId: "prod_1",
      siteId: "global",
      language: "en",
      providerCode: "openai",
      model: "gpt-5.1",
    })

    expect(adminApiMock).toHaveBeenLastCalledWith("/admin/content/seo/suggest", {
      method: "POST",
      body: {
        entity_type: "product",
        entity_id: "prod_1",
        site_id: "global",
        language: "en",
        provider_code: "openai",
        model: "gpt-5.1",
      },
    })
  })

  it("maps analytics events and dispatches to product-admin DTOs", async () => {
    adminApiMock.mockImplementation(async (path: string) => {
      if (path === "/admin/analytics/events?limit=100") {
        return {
          events: [
            {
              id: "event_1",
              event_name: "checkout.completed",
              source: "storefront",
              status: "ready",
              order_id: "order_1",
              payment_attempt_id: "payatt_1",
              created_at: "2026-06-10T00:00:00.000Z",
            },
          ],
        }
      }

      if (path === "/admin/analytics/dispatches?limit=100") {
        return {
          dispatches: [
            {
              id: "dispatch_1",
              event_id: "event_1",
              destination_code: "ga4",
              status: "failed",
              attempt_count: 2,
              next_retry_at: "2026-06-10T01:00:00.000Z",
              delivered_at: null,
              error_message: "Provider unavailable",
              created_at: "2026-06-10T00:05:00.000Z",
            },
          ],
        }
      }

      throw new Error(`Unexpected path: ${path}`)
    })

    const events = await loadAnalyticsEvents()
    const dispatches = await loadAnalyticsDispatches()

    expect(events.events[0]).toEqual({
      id: "event_1",
      eventName: "checkout.completed",
      source: "storefront",
      status: "ready",
      orderId: "order_1",
      paymentAttemptId: "payatt_1",
      createdAt: "2026-06-10T00:00:00.000Z",
    })
    expect(dispatches.dispatches[0]).toEqual({
      id: "dispatch_1",
      eventId: "event_1",
      destinationCode: "ga4",
      status: "failed",
      attemptCount: 2,
      nextRetryAt: "2026-06-10T01:00:00.000Z",
      deliveredAt: null,
      errorMessage: "Provider unavailable",
      createdAt: "2026-06-10T00:05:00.000Z",
    })
    expect(events.events[0]).not.toHaveProperty("event_name")
    expect(events.events[0]).not.toHaveProperty("payment_attempt_id")
    expect(dispatches.dispatches[0]).not.toHaveProperty("destination_code")
    expect(dispatches.dispatches[0]).not.toHaveProperty("attempt_count")
  })

  it("maps audit logs and filters through the product-admin facade", async () => {
    adminApiMock.mockResolvedValue({
      audit_logs: [
        {
          id: "audit_1",
          actor_type: "admin",
          actor_id: "user_1",
          action: "order.complete",
          entity_type: "order",
          entity_id: "order_1",
          risk_level: "medium",
          metadata_json: { source: "manual" },
          created_at: "2026-06-11T00:00:00.000Z",
        },
      ],
    })

    const result = await loadAuditLogs({
      action: "order.complete",
      entityType: "order",
      entityId: "order_1",
    })

    expect(adminApiMock).toHaveBeenCalledWith(
      "/admin/audit-logs?limit=100&action=order.complete&entity_type=order&entity_id=order_1",
    )
    expect(result.logs[0]).toEqual({
      id: "audit_1",
      actorType: "admin",
      actorId: "user_1",
      action: "order.complete",
      entityType: "order",
      entityId: "order_1",
      riskLevel: "medium",
      metadata: { source: "manual" },
      createdAt: "2026-06-11T00:00:00.000Z",
    })
    expect(result.logs[0]).not.toHaveProperty("actor_type")
    expect(result.logs[0]).not.toHaveProperty("entity_id")
    expect(result.logs[0]).not.toHaveProperty("metadata_json")
  })

  it("maps analytics replay from product input to the current backend body", async () => {
    adminApiMock.mockResolvedValue({ dispatch: { id: "dispatch_1" } })

    await replayAnalyticsDispatch("dispatch_1")

    expect(adminApiMock).toHaveBeenCalledWith("/admin/analytics/dispatches", {
      method: "POST",
      body: {
        dispatch_id: "dispatch_1",
      },
    })
  })
})
