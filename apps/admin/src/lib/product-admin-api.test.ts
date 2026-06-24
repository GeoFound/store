import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  createSalesChannel,
  createDigitalDelivery,
  createCustomer,
  importCredentialBatch,
  loadAfterSales,
  loadAnalyticsDispatches,
  loadAnalyticsEvents,
  loadAuditLogs,
  loadCustomers,
  loadCredentialInventory,
  loadDeliveryWorkspace,
  loadOrders,
  loadPaymentWorkspace,
  loadProductCatalog,
  loadProductPublishingWorkspace,
  loadSeoPerformance,
  loadSeoWorkspace,
  loadSupplierWorkspace,
  loadSystemSettings,
  replayAnalyticsDispatch,
  retrieveOrder,
  saveSupplierMapping,
  suggestSeoDocument,
  togglePaymentChannel,
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
