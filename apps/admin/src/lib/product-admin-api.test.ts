import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  createCustomer,
  importCredentialBatch,
  loadCustomers,
  loadCredentialInventory,
  loadOrders,
  loadProductCatalog,
  loadProductPublishingWorkspace,
  retrieveOrder,
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
})
