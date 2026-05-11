import { buildOrderFromCart, CART_ORDER_QUERY_FIELDS } from "../cart-order"

describe("buildOrderFromCart", () => {
  it("includes metadata fields required for template-based fulfillment", () => {
    expect(CART_ORDER_QUERY_FIELDS).toEqual(
      expect.arrayContaining([
        "items.metadata",
        "items.variant.metadata",
        "items.variant.product.metadata",
      ])
    )
  })

  it("creates a Medusa order payload from cart data", () => {
    const order = buildOrderFromCart({
      cart: {
        id: "cart_123",
        region_id: "reg_123",
        sales_channel_id: "sc_123",
        email: "buyer@example.com",
        currency_code: "usd",
        locale: "en",
        total: 4200,
        metadata: {
          source: "test",
        },
        shipping_address: {
          id: "addr_1",
          first_name: "Jane",
          last_name: "Doe",
          address_1: "123 Main",
          city: "Tokyo",
          country_code: "jp",
        },
        billing_address: {
          id: "addr_2",
          first_name: "Jane",
          last_name: "Doe",
          address_1: "123 Main",
          city: "Tokyo",
          country_code: "jp",
        },
        items: [
          {
            id: "item_123",
            quantity: 2,
            title: "Credential Pack",
            unit_price: 2100,
            variant: {
              id: "variant_123",
              title: "Default",
              sku: "SKU-123",
              requires_shipping: false,
              is_discountable: true,
              product: {
                id: "prod_123",
                title: "Credential Pack",
                handle: "credential-pack",
              },
            },
            tax_lines: [],
            adjustments: [],
          },
        ],
      },
      customerId: "cus_guest_123",
      transactionReferenceId: "payatt_123",
    })

    expect(order.customer_id).toBe("cus_guest_123")
    expect(order.email).toBe("buyer@example.com")
    expect(order.shipping_address).toMatchObject({
      first_name: "Jane",
      city: "Tokyo",
    })
    expect(order.shipping_address).not.toHaveProperty("id")
    expect(order.items).toHaveLength(1)
    expect(order.transactions).toEqual([
      expect.objectContaining({
        reference: "payment_attempt",
        reference_id: "payatt_123",
        amount: 4200,
      }),
    ])
  })

  it("rejects carts without items", () => {
    expect(() =>
      buildOrderFromCart({
        cart: {
          email: "buyer@example.com",
          currency_code: "usd",
          items: [],
        },
        transactionReferenceId: "payatt_123",
      })
    ).toThrow("Cart must contain at least one item")
  })
})
