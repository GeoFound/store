import {
  registerStorefrontExtension,
  type StorefrontExtensionSlot,
} from "./registry"
import { Ga4StorefrontScript } from "../plugins/analytics-ga4/script"
import { HotjarStorefrontScript } from "../plugins/analytics-hotjar/script"

let registered = false

function ExtensionCard(props: {
  eyebrow: string
  title: string
  body: string
}) {
  return (
    <div className="border border-stone-200 bg-stone-50 p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
        {props.eyebrow}
      </div>
      <h3 className="mt-2 text-lg font-semibold text-stone-950">{props.title}</h3>
      <p className="mt-2 text-sm leading-6 text-stone-700">{props.body}</p>
    </div>
  )
}

export function ensureStorefrontExtensionsRegistered() {
  if (registered) {
    return
  }

  registerSlot("home.hero.after", {
    name: "guest-order-access.recovery-hint",
    pluginId: "guest-order-access",
    order: 10,
    component: () => (
      <ExtensionCard
        eyebrow="guest-order-access"
        title="Guest recovery stays outside checkout friction"
        body="Order recovery, access-link claim, and delivery lookup all run through the same event-driven guest access layer."
      />
    ),
  })

  registerSlot("home.products.after", {
    name: "digital-delivery.delivery-note",
    pluginId: "digital-delivery",
    order: 10,
    component: () => (
      <ExtensionCard
        eyebrow="digital-delivery"
        title="Delivery handlers are swappable"
        body="The storefront is no longer coupled to one fulfillment mode. Credential, code, file, or manual delivery handlers can plug into the same purchase flow."
      />
    ),
  })

  registerSlot("products.header.after", {
    name: "payment-router.channel-note",
    pluginId: "payment-router",
    order: 10,
    component: () => (
      <ExtensionCard
        eyebrow="payment-router"
        title="Payment channels can vary by plugin"
        body="This catalog can stay stable while payment providers and channel policies change underneath through the platform registry."
      />
    ),
  })

  registerSlot("products.header.after", {
    name: "marketing-engine.checkout-attribution-note",
    pluginId: "marketing-engine",
    order: 20,
    component: () => (
      <ExtensionCard
        eyebrow="marketing-engine"
        title="Checkout accepts coupon, referral, and attribution context"
        body="Marketing strategies are resolved during payment attempt creation. Valid coupon/referral signals are attached to the payment record and finalized after successful payment."
      />
    ),
  })

  registerSlot("layout.body.end", {
    name: "analytics-ga4.storefront-script",
    pluginId: "analytics-ga4",
    order: 5,
    component: () => <Ga4StorefrontScript />,
  })

  registerSlot("layout.body.end", {
    name: "analytics-hotjar.storefront-script",
    pluginId: "analytics-hotjar",
    order: 6,
    component: () => <HotjarStorefrontScript />,
  })

  registered = true
}

function registerSlot(
  slot: StorefrontExtensionSlot,
  registration: Omit<
    Parameters<typeof registerStorefrontExtension>[0],
    "slot"
  >
) {
  registerStorefrontExtension({
    slot,
    ...registration,
  })
}

export function resetStorefrontExtensionDefaultsForTests() {
  registered = false
}
