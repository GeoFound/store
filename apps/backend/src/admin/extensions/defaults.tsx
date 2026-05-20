import { Badge, Container, Heading, Text } from "@medusajs/ui"
import { useTranslation } from "react-i18next"
import {
  registerAdminExtension,
  type AdminExtensionSlot,
} from "./registry"

let registered = false

function ExtensionPanel(props: {
  eyebrow: string
  titleKey: string
  bodyKey: string
}) {
  const { t } = useTranslation()

  return (
    <Container className="border border-ui-border-base bg-ui-bg-subtle p-5">
      <Badge color="blue">{props.eyebrow}</Badge>
      <Heading level="h3" className="mt-3">
        {t(props.titleKey)}
      </Heading>
      <Text className="mt-2 text-ui-fg-subtle">{t(props.bodyKey)}</Text>
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
        titleKey="adminExtensions.paymentsTitle"
        bodyKey="adminExtensions.paymentsBody"
      />
    ),
  })

  registerSlot("payments.after", {
    name: "marketing-engine.checkout-context-note",
    pluginId: "marketing-engine",
    order: 20,
    component: () => (
      <ExtensionPanel
        eyebrow="marketing-engine"
        titleKey="adminExtensions.marketingTitle"
        bodyKey="adminExtensions.marketingBody"
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
        titleKey="adminExtensions.deliveryPolicyTitle"
        bodyKey="adminExtensions.deliveryPolicyBody"
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
