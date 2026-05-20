# Supplier Procurement

Supplier procurement is the external-resource layer for API-backed virtual goods such as Reloadly gift cards, Reloadly airtime, G2A keys, and future suppliers.

## Boundaries

- `supplier-provider` talks to a supplier API.
- `supplier-procurement` stores variant-to-SKU mappings and procurement order state.
- `supplier-procurement` delivery handler creates or updates the encrypted `digital-delivery` record.
- Payment and order finalization still use the existing capability contracts; they do not call Reloadly, G2A, or any supplier module directly.

## Product Setup

Use a supplier-backed template and fulfillment policy in product or variant metadata:

```json
{
  "template_code": "reloadly-gift-card",
  "fulfillment_policy_code": "external-api",
  "supplier_provider": "reloadly",
  "supplier_sku": "amazon-jp-1000",
  "supplier_region": "JP",
  "supplier_currency": "jpy"
}
```

If metadata omits `supplier_provider` or `supplier_sku`, the handler resolves an enabled mapping from Admin: `Suppliers -> Variant Supplier Mapping`.

Supported built-in templates:

- `reloadly-gift-card`
- `reloadly-airtime`
- `g2a-key`

All use:

- `fulfillmentPolicyCode`: `external-api`
- `inventoryHandlerCode`: `noop`
- `deliveryHandlerCode`: `supplier-procurement`

## Provider Overrides

Provider paths and request bodies can be overridden per mapping or product metadata:

```json
{
  "supplier_procure_path": "/orders",
  "supplier_retrieve_path": "/orders/{providerOrderId}/keys",
  "supplier_request_body": {
    "product_id": "external-product-id",
    "quantity": 1
  }
}
```

Use provider-specific aliases when useful:

- Reloadly: `reloadly_procure_path`, `reloadly_retrieve_path`, `reloadly_operation`
- G2A: `g2a_procure_path`, `g2a_retrieve_path`

## Operational Flow

1. Checkout creates a payment attempt.
2. Reservation stores a no-inventory fulfillment item for `external-api`.
3. Payment finalization calls `delivery-handler:supplier-procurement`.
4. The handler resolves provider + SKU, creates an idempotent procurement order, calls the supplier, and writes a delivery record.
5. If the supplier returns pending, Admin can retry the procurement later. A delivered result updates the pending delivery.

## Security

Supplier fulfillment payloads are encrypted with `SUPPLIER_ENCRYPTION_KEY`, falling back to `DELIVERY_ENCRYPTION_KEY` if unset. Supplier API secrets must stay in backend env only.
