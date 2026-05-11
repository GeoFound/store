import { Badge, Container, Heading, Text } from "@medusajs/ui"
import {
  registerAdminExtension,
  type AdminExtensionSlot,
} from "./registry"

let registered = false

function ExtensionPanel(props: {
  eyebrow: string
  title: string
  body: string
}) {
  return (
    <Container className="border border-ui-border-base bg-ui-bg-subtle p-5">
      <Badge color="blue">{props.eyebrow}</Badge>
      <Heading level="h3" className="mt-3">
        {props.title}
      </Heading>
      <Text className="mt-2 text-ui-fg-subtle">{props.body}</Text>
    </Container>
  )
}

export function ensureAdminExtensionsRegistered() {
  if (registered) {
    return
  }

  registerSlot("payments.after", {
    name: "support-audit.payment-ops-note",
    pluginId: "support-audit",
    order: 10,
    component: () => (
      <ExtensionPanel
        eyebrow="support-audit"
        title="High-risk payment actions are audited"
        body="Manual mark-paid and webhook-paid operations now emit domain events and write audit logs through the support-audit subscriber."
      />
    ),
  })

  registerSlot("deliveries.after", {
    name: "digital-delivery.delivery-policy-note",
    pluginId: "digital-delivery",
    order: 10,
    component: () => (
      <ExtensionPanel
        eyebrow="digital-delivery"
        title="Delivery handlers are registry-driven"
        body="This admin surface now sits on top of the delivery handler registry, so new delivery implementations can mount here without rewriting the delivery page flow."
      />
    ),
  })

  registered = true
}

function registerSlot(
  slot: AdminExtensionSlot,
  registration: Omit<
    Parameters<typeof registerAdminExtension>[0],
    "slot"
  >
) {
  registerAdminExtension({
    slot,
    ...registration,
  })
}

export function resetAdminExtensionDefaultsForTests() {
  registered = false
}
