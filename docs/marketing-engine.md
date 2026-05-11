# Marketing Engine

The `marketing-engine` module adds a pluggable marketing layer on top of checkout and payment finalization.

## What It Adds

- Campaign management (`marketing_campaign`)
- Offer definitions (`marketing_offer`)
- Coupon pools and redemption state (`marketing_coupon`, `marketing_coupon_redemption`)
- Referral links and reward issuance (`marketing_referral_link`, `marketing_referral_reward`)
- Attribution and lifecycle touchpoints (`marketing_touchpoint`)
- Strategy plugin capability: `marketing-strategy`

## Runtime Strategy Model

Strategies are capability contracts and follow the same enable/disable model as other platform plugins.

Built-in strategies in this repository:

- `coupon-code`
- `referral-link`
- `utm-attribution`
- `noop` (fallback)

Global plugin toggle:

```env
PLATFORM_DISABLED_PLUGINS=marketing-engine
```

Backend runtime merges both:

- `PLATFORM_ENABLED_PLUGINS` + `NEXT_PUBLIC_PLATFORM_ENABLED_PLUGINS`
- `PLATFORM_DISABLED_PLUGINS` + `NEXT_PUBLIC_PLATFORM_DISABLED_PLUGINS`

Duplicate IDs are deduplicated.

Disable specific strategies:

```env
PLATFORM_DISABLED_CONTRACTS=marketing-strategy:coupon-code,referral-link
```

## Checkout Integration

`POST /store/carts/:cart_id/payments` now accepts:

```json
{
  "payment_method": "manual",
  "marketing": {
    "coupon_code": "SAVE10",
    "referral_code": "CREATOR_A",
    "utm_source": "newsletter",
    "utm_medium": "email",
    "utm_campaign": "launch_week",
    "utm_content": "hero_cta",
    "utm_term": "digital_bundle"
  }
}
```

Behavior:

1. Payment attempt is created.
2. Marketing strategies run and resolve context.
3. Coupon redemptions are reserved (if coupon strategy applies).
4. Touchpoint `checkout_context_attached` is recorded.
5. On successful payment finalization:
   - coupon reservation is confirmed
   - referral reward is issued
   - touchpoint `payment_attempt.finalized` is recorded
6. On failed/expired/closed attempt:
   - coupon reservation is released
   - touchpoint `payment_attempt.closed` is recorded

## Admin APIs

- `GET/POST /admin/marketing/campaigns`
- `GET/POST /admin/marketing/offers`
- `GET/POST /admin/marketing/coupons`
- `GET/POST /admin/marketing/referral-links`
- `GET /admin/marketing/touchpoints`

When `marketing-engine` is disabled, these APIs return `503`.

## Store APIs

- `GET /store/marketing/campaigns`

When `marketing-engine` is disabled, this API also returns `503`.

## Admin UI

A new Admin page is available at:

- `Marketing` (route: `/app/marketing`)

This page currently supports creating campaigns/coupons/referral links and monitoring touchpoints.
