export const ADMIN_CONTROL_PANEL_POLICY = {
  version: "1.0.0",
  purpose:
    "Define which product and platform capabilities require a human-usable backend control panel surface.",
  admissionCriteria: [
    {
      id: "external-provider",
      title: "External provider or account",
      description:
        "Provider credentials, endpoint health, account status, or webhook state can affect product behavior.",
    },
    {
      id: "money-or-cost",
      title: "Money, cost, or quota",
      description:
        "The capability can spend money, block revenue, consume quota, or change customer-visible billing outcomes.",
    },
    {
      id: "customer-or-order-impact",
      title: "Customer, order, or delivery impact",
      description:
        "The capability can change checkout, fulfillment, access recovery, support, or customer-visible content.",
    },
    {
      id: "queue-or-retry",
      title: "Queue, retry, or background work",
      description:
        "Operators need visibility into pending, failed, replayable, or review-required work.",
    },
    {
      id: "human-review",
      title: "Human review or approval",
      description:
        "The capability can create drafts, decisions, or artifacts that should be accepted, edited, rejected, or audited by a human.",
    },
    {
      id: "multi-site-configuration",
      title: "Site-specific configuration",
      description:
        "Behavior differs by site, tenant, sales channel, product type, or deployment environment.",
    },
    {
      id: "security-or-compliance",
      title: "Security, audit, or compliance",
      description:
        "The capability handles secrets, sensitive data, provider access, risk signals, or compliance-relevant records.",
    },
  ],
  requiredSurface: [
    {
      id: "status",
      title: "Status",
      description:
        "Show enabled state, readiness, health, recent failures, and missing configuration without exposing secrets.",
    },
    {
      id: "configuration",
      title: "Configuration",
      description:
        "Show provider codes, endpoint references, model or handler choices, site scope, and secret references.",
    },
    {
      id: "queues",
      title: "Queues",
      description:
        "Show pending, failed, retryable, and human-review items with timestamps and ownership.",
    },
    {
      id: "operator-actions",
      title: "Operator actions",
      description:
        "Provide only reversible or auditable actions unless a decision gate explicitly requires human approval.",
    },
    {
      id: "auditability",
      title: "Auditability",
      description:
        "Expose recent activity, actor context, artifact references, and links to audit logs where available.",
    },
    {
      id: "safe-empty-state",
      title: "Safe empty state",
      description:
        "Empty or disabled states must still explain readiness in operational terms and avoid pretending the capability is healthy.",
    },
  ],
} as const
