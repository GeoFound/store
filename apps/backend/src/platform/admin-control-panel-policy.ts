export const ADMIN_CONTROL_PANEL_POLICY = {
  "version": "1.3.0",
  "purpose": "Define which product and platform capabilities require a human-usable backend control panel surface, production gate mapping, and machine evidence.",
  "productionControlRule": "Any capability that can affect launch, revenue, fulfillment, customer access, security, cost, provider state, data, backup, rollback, compliance, or a human production decision must appear in the backend control panel and must map to an executable gate or explicit evidence field before production promotion.",
  "admissionCriteria": [
    {
      "id": "external-provider",
      "title": "External provider or account",
      "description": "Provider credentials, endpoint health, account status, or webhook state can affect product behavior."
    },
    {
      "id": "money-or-cost",
      "title": "Money, cost, or quota",
      "description": "The capability can spend money, block revenue, consume quota, or change customer-visible billing outcomes."
    },
    {
      "id": "customer-or-order-impact",
      "title": "Customer, order, or delivery impact",
      "description": "The capability can change checkout, fulfillment, access recovery, support, or customer-visible content."
    },
    {
      "id": "queue-or-retry",
      "title": "Queue, retry, or background work",
      "description": "Operators need visibility into pending, failed, replayable, or review-required work."
    },
    {
      "id": "human-review",
      "title": "Human review or approval",
      "description": "The capability can create drafts, decisions, or artifacts that should be accepted, edited, rejected, or audited by a human."
    },
    {
      "id": "multi-site-configuration",
      "title": "Site-specific configuration",
      "description": "Behavior differs by site, tenant, sales channel, product type, or deployment environment."
    },
    {
      "id": "security-or-compliance",
      "title": "Security, audit, or compliance",
      "description": "The capability handles secrets, sensitive data, provider access, risk signals, or compliance-relevant records."
    },
    {
      "id": "production-gate",
      "title": "Production gate or launch decision",
      "description": "The capability contributes to staging, production promotion, go-live, rollback, or irreversible runtime decisions."
    },
    {
      "id": "runtime-evidence",
      "title": "Runtime evidence",
      "description": "The capability needs real runtime proof, smoke checks, provider probes, or generated evidence before it is safe to rely on."
    }
  ],
  "requiredSurface": [
    {
      "id": "status",
      "title": "Status",
      "description": "Show enabled state, readiness, health, recent failures, and missing configuration without exposing secrets."
    },
    {
      "id": "configuration",
      "title": "Configuration",
      "description": "Show provider codes, endpoint references, model or handler choices, site scope, and secret references."
    },
    {
      "id": "queues",
      "title": "Queues",
      "description": "Show pending, failed, retryable, and human-review items with timestamps and ownership."
    },
    {
      "id": "operator-actions",
      "title": "Operator actions",
      "description": "Provide only reversible or auditable actions unless a decision gate explicitly requires human approval."
    },
    {
      "id": "auditability",
      "title": "Auditability",
      "description": "Expose recent activity, actor context, artifact references, and links to audit logs where available."
    },
    {
      "id": "evidence",
      "title": "Evidence",
      "description": "Expose the command, timestamp, result, report path, or evidence reference used by production gates."
    },
    {
      "id": "production-gates",
      "title": "Production gates",
      "description": "Show which site lifecycle controls and evidence fields block promotion."
    },
    {
      "id": "safe-empty-state",
      "title": "Safe empty state",
      "description": "Empty or disabled states must still explain readiness in operational terms and avoid pretending the capability is healthy."
    }
  ],
  "forbiddenSurface": [
    {
      "id": "plaintext-secrets",
      "title": "Plaintext secrets",
      "description": "Never render API secrets, database URLs, Redis URLs, private keys, certificate private keys, or provider tokens."
    },
    {
      "id": "arbitrary-command-execution",
      "title": "Arbitrary command execution",
      "description": "Never expose a free-form shell command input in the backend panel."
    },
    {
      "id": "unguarded-irreversible-action",
      "title": "Unguarded irreversible action",
      "description": "Never allow go-live, rollback, DNS mutation, WAF mutation, Access mutation, data migration, or production write enablement without an explicit human gate and machine evidence."
    },
    {
      "id": "human-attestation-as-proof",
      "title": "Human attestation as proof",
      "description": "Human confirmation is a decision input only; it must not replace executable runtime evidence."
    }
  ],
  "informationArchitecture": {
    "defaultAdminRoute": "/dashboard",
    "routePrefix": "/dashboard",
    "sectionOrder": [
      {
        "id": "overview",
        "title": "Overview",
        "description": "Cross-domain triage, summary metrics, and the first place an operator lands."
      },
      {
        "id": "catalog",
        "title": "Catalog",
        "description": "Product creation, publishing readiness, templates, collections, categories, and pricing structure."
      },
      {
        "id": "orders",
        "title": "Orders and delivery",
        "description": "Orders, fulfillment state, manual delivery, and order-linked recovery work."
      },
      {
        "id": "inventory",
        "title": "Inventory",
        "description": "Credential batches, credential item state, stock reservations, and replenishment work."
      },
      {
        "id": "payments_suppliers",
        "title": "Payments and suppliers",
        "description": "Payment routing, provider attempts, supplier configuration, supplier mappings, and procurement retries."
      },
      {
        "id": "growth",
        "title": "Growth",
        "description": "Content, marketing campaigns, coupons, referral links, analytics events, privacy consent, and replay queues."
      },
      {
        "id": "customers_support",
        "title": "Customers and support",
        "description": "Customer records, customer groups, account access, after-sales requests, replacements, and support outcomes."
      },
      {
        "id": "intelligence",
        "title": "Intelligence",
        "description": "AI provider readiness, AI task plugins, generated work queues, and human review for AI output."
      },
      {
        "id": "risk_system",
        "title": "Risk and system",
        "description": "Production readiness, security, Cloudflare, backup, rollback, audit logs, and other high-risk operator controls."
      }
    ],
    "routePlacements": [
      {
        "route": "/dashboard",
        "section": "overview",
        "title": "Dashboard",
        "owner": "admin-ui",
        "purpose": "Operator home, cross-domain status, and next actions."
      },
      {
        "route": "/dashboard/products",
        "section": "catalog",
        "title": "Products",
        "owner": "medusa-core",
        "purpose": "Product, variant, collection, category, and sales-channel management."
      },
      {
        "route": "/dashboard/product-publishing",
        "section": "catalog",
        "title": "Product publishing",
        "owner": "product-templates",
        "purpose": "Template, fulfillment handler, inventory, and delivery readiness before a product is treated as sellable."
      },
      {
        "route": "/dashboard/orders",
        "section": "orders",
        "title": "Orders",
        "owner": "medusa-core",
        "purpose": "Order history, payment context, customer context, and post-purchase investigation."
      },
      {
        "route": "/dashboard/deliveries",
        "section": "orders",
        "title": "Deliveries",
        "owner": "digital-delivery",
        "purpose": "Pending fulfillment, manual delivery creation, and delivery records."
      },
      {
        "route": "/dashboard/credentials",
        "section": "inventory",
        "title": "Credential inventory",
        "owner": "credential-inventory",
        "purpose": "Credential import, reservation, release, sold state, and depleted batches."
      },
      {
        "route": "/dashboard/payments",
        "section": "payments_suppliers",
        "title": "Payments",
        "owner": "payment-router",
        "purpose": "Payment attempts, provider channels, recovery actions, and webhook readiness."
      },
      {
        "route": "/dashboard/suppliers",
        "section": "payments_suppliers",
        "title": "Suppliers",
        "owner": "supplier-procurement",
        "purpose": "Supplier mappings, provider configuration, procurement state, and retry visibility."
      },
      {
        "route": "/dashboard/content",
        "section": "growth",
        "title": "Content",
        "owner": "content-core",
        "purpose": "Content entries, revisions, asset registration, upload policies, and AI editorial review."
      },
      {
        "route": "/dashboard/seo",
        "section": "growth",
        "title": "SEO",
        "owner": "content-core",
        "purpose": "SEO documents, audits, performance views, and generated suggestions."
      },
      {
        "route": "/dashboard/marketing",
        "section": "growth",
        "title": "Marketing",
        "owner": "marketing-engine",
        "purpose": "Campaigns, offers, coupons, referral links, and touchpoints."
      },
      {
        "route": "/dashboard/analytics",
        "section": "growth",
        "title": "Analytics",
        "owner": "analytics-core",
        "purpose": "Analytics events, dispatch queue visibility, and replay controls."
      },
      {
        "route": "/dashboard/customers",
        "section": "customers_support",
        "title": "Customers",
        "owner": "medusa-core",
        "purpose": "Customer records, customer groups, and account state."
      },
      {
        "route": "/dashboard/after-sales",
        "section": "customers_support",
        "title": "After-sales",
        "owner": "support-audit",
        "purpose": "Support requests, replacements, refunds, and audit-ready outcomes."
      },
      {
        "route": "/dashboard/ai",
        "section": "intelligence",
        "title": "AI",
        "owner": "ai-core",
        "purpose": "AI provider readiness, policy visibility, task plugins, run queue, and human review."
      },
      {
        "route": "/dashboard/ops",
        "section": "risk_system",
        "title": "Operations",
        "owner": "ops-control",
        "purpose": "Runtime readiness, security, maintenance, backup, rollback, and Cloudflare posture."
      },
      {
        "route": "/dashboard/audit-logs",
        "section": "risk_system",
        "title": "Audit logs",
        "owner": "support-audit",
        "purpose": "Operator activity, support records, and compliance inspection."
      },
      {
        "route": "/dashboard/system",
        "section": "risk_system",
        "title": "System settings",
        "owner": "admin-ui",
        "purpose": "Store, users, regions, sales channels, API keys, feature flags, and plugin state."
      }
    ],
    "extensionPlacementRule": "New backend admin functionality must be assigned to the most specific section above. Use risk_system for production gates, secrets, security, backup, rollback, or audit; payments_suppliers for revenue/provider fulfillment; growth for public content, campaigns, analytics, and privacy; customers_support for account access and support; intelligence for AI provider or generated-work review; overview only for cross-domain summaries.",
    "routeSourceRoot": "apps/admin/src/app/dashboard"
  },
  "requiredProductionSurfaces": [
    {
      "id": "launch-readiness",
      "title": "Launch readiness",
      "owner": "ops-control",
      "backendPanelRequired": true,
      "productionGateRequired": true,
      "humanChoiceRequired": true,
      "adminRoute": "/dashboard/ops",
      "controlPanelSection": "risk_system",
      "profileControls": [
        "backend_control_panel_required",
        "runtime_health_required",
        "human_gate_required"
      ],
      "evidenceFields": [
        "last_backend_control_panel_ref",
        "last_runtime_health_ref",
        "human_gate_ref"
      ],
      "runtimeCommands": [
        "pnpm deploy:health"
      ],
      "configKeys": [
        "NODE_ENV",
        "PORT",
        "SITE_ID",
        "SITE_ENV",
        "COOKIE_SECRET",
        "JWT_SECRET",
        "DATABASE_URL",
        "REDIS_URL"
      ]
    },
    {
      "id": "site-tenancy",
      "title": "Site tenancy and profile",
      "owner": "profile-system",
      "backendPanelRequired": true,
      "productionGateRequired": true,
      "humanChoiceRequired": true,
      "adminRoute": "/dashboard/ops",
      "controlPanelSection": "risk_system",
      "profileControls": [
        "backend_control_panel_required"
      ],
      "evidenceFields": [
        "last_backend_control_panel_ref"
      ],
      "runtimeCommands": [
        "pnpm site:validate:all"
      ],
      "configKeys": [
        "NEXT_PUBLIC_SITE_ID",
        "NEXT_PUBLIC_SITE_ENV",
        "TENANCY_MODE",
        "TENANT_ALLOWED_HOSTS",
        "TENANT_FAIL_ON_HOST_MISMATCH",
        "TENANT_SHARED_DATA_PLANE_READY"
      ]
    },
    {
      "id": "dns-cloudflare-edge",
      "title": "DNS and Cloudflare edge",
      "owner": "ops-control",
      "backendPanelRequired": true,
      "productionGateRequired": true,
      "humanChoiceRequired": true,
      "adminRoute": "/dashboard/ops",
      "controlPanelSection": "risk_system",
      "profileControls": [
        "cloudflare_required",
        "dns_required",
        "cloudflare_ssl_strict_required",
        "edge_preflight_required"
      ],
      "evidenceFields": [
        "last_dns_ref",
        "last_cloudflare_ssl_ref",
        "last_edge_preflight_ref"
      ],
      "runtimeCommands": [
        "pnpm deploy:dns",
        "pnpm deploy:edge"
      ],
      "configKeys": [
        "STOREFRONT_PUBLIC_URL",
        "API_PUBLIC_URL",
        "EXPECT_CLOUDFLARE",
        "REQUIRE_CLOUDFLARE_SSL_MODE",
        "CLOUDFLARE_ZONE_ID",
        "CLOUDFLARE_API_TOKEN"
      ]
    },
    {
      "id": "edge-security",
      "title": "WAF, Access, origin, and rate limits",
      "owner": "security-guard",
      "backendPanelRequired": true,
      "productionGateRequired": true,
      "humanChoiceRequired": true,
      "adminRoute": "/dashboard/ops",
      "controlPanelSection": "risk_system",
      "profileControls": [
        "cloudflare_waf_required",
        "admin_edge_protection_required",
        "redis_rate_limit_smoke_required"
      ],
      "evidenceFields": [
        "last_cloudflare_waf_ref",
        "last_admin_edge_ref",
        "last_rate_limit_ref"
      ],
      "runtimeCommands": [
        "pnpm deploy:waf",
        "pnpm deploy:admin-edge",
        "pnpm deploy:rate-limit",
        "pnpm smoke:admin"
      ],
      "configKeys": [
        "ADMIN_CORS",
        "AUTH_CORS",
        "STORE_CORS",
        "SECURITY_RATE_LIMIT_STORE",
        "CLOUDFLARE_WAF_MANAGED_RULES_ENABLED",
        "CLOUDFLARE_ACCESS_ADMIN_ENABLED",
        "ADMIN_MEDUSA_BACKEND_URL",
        "ADMIN_TRUSTED_ORIGINS"
      ]
    },
    {
      "id": "payment-checkout",
      "title": "Payment and checkout",
      "owner": "payment-router",
      "backendPanelRequired": true,
      "productionGateRequired": true,
      "humanChoiceRequired": true,
      "adminRoute": "/dashboard/payments",
      "controlPanelSection": "payments_suppliers",
      "profileControls": [
        "payment_provider_required",
        "regression_required"
      ],
      "evidenceFields": [
        "last_payment_provider_ref",
        "last_regression_ref"
      ],
      "runtimeCommands": [
        "pnpm deploy:regression"
      ],
      "configKeys": [
        "PLISIO_API_KEY",
        "PLISIO_CALLBACK_BASE_URL",
        "MANUAL_WEBHOOK_SECRET"
      ]
    },
    {
      "id": "supplier-fulfillment",
      "title": "Supplier fulfillment",
      "owner": "supplier-procurement",
      "backendPanelRequired": true,
      "productionGateRequired": true,
      "humanChoiceRequired": true,
      "adminRoute": "/dashboard/suppliers",
      "controlPanelSection": "payments_suppliers",
      "profileControls": [
        "supplier_readiness_required"
      ],
      "evidenceFields": [
        "last_supplier_readiness_ref"
      ],
      "runtimeCommands": [
        "pnpm deploy:regression"
      ],
      "configKeys": [
        "SUPPLIER_ENCRYPTION_KEY",
        "SUPPLIER_AUTO_PROCUREMENT_ENABLED",
        "RELOADLY_CLIENT_ID",
        "RELOADLY_CLIENT_SECRET",
        "G2A_API_KEY"
      ]
    },
    {
      "id": "inventory-delivery",
      "title": "Inventory and digital delivery",
      "owner": "digital-delivery",
      "backendPanelRequired": true,
      "productionGateRequired": true,
      "humanChoiceRequired": false,
      "adminRoute": "/dashboard/credentials",
      "controlPanelSection": "inventory",
      "profileControls": [
        "delivery_inventory_required",
        "regression_required"
      ],
      "evidenceFields": [
        "last_delivery_inventory_ref",
        "last_regression_ref"
      ],
      "runtimeCommands": [
        "pnpm deploy:regression"
      ],
      "configKeys": [
        "CREDENTIAL_ENCRYPTION_KEY",
        "DELIVERY_ENCRYPTION_KEY"
      ]
    },
    {
      "id": "customer-access",
      "title": "Customer account and order access",
      "owner": "guest-order-access",
      "backendPanelRequired": true,
      "productionGateRequired": true,
      "humanChoiceRequired": true,
      "adminRoute": "/dashboard/ops",
      "controlPanelSection": "customers_support",
      "profileControls": [
        "customer_access_required",
        "regression_required"
      ],
      "evidenceFields": [
        "last_customer_access_ref",
        "last_regression_ref"
      ],
      "runtimeCommands": [
        "pnpm deploy:regression"
      ],
      "configKeys": [
        "CUSTOMER_ACCOUNT_MODE",
        "CUSTOMER_PASSWORD_RESET_ENABLED",
        "CUSTOMER_EMAIL_VERIFICATION_STRATEGY",
        "ORDER_ACCESS_PROVIDER_CODE"
      ]
    },
    {
      "id": "storefront-commerce",
      "title": "Storefront commerce runtime",
      "owner": "storefront-commerce",
      "backendPanelRequired": true,
      "productionGateRequired": true,
      "humanChoiceRequired": false,
      "adminRoute": "/dashboard/ops",
      "controlPanelSection": "risk_system",
      "profileControls": [
        "runtime_health_required"
      ],
      "evidenceFields": [
        "last_runtime_health_ref"
      ],
      "runtimeCommands": [
        "pnpm deploy:health"
      ],
      "configKeys": [
        "MEDUSA_BACKEND_URL",
        "NEXT_PUBLIC_MEDUSA_BACKEND_URL",
        "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY"
      ]
    },
    {
      "id": "notifications",
      "title": "Transactional notifications",
      "owner": "notification-resend",
      "backendPanelRequired": true,
      "productionGateRequired": true,
      "humanChoiceRequired": true,
      "adminRoute": "/dashboard/ops",
      "controlPanelSection": "risk_system",
      "profileControls": [
        "notification_readiness_required"
      ],
      "evidenceFields": [
        "last_notification_ref"
      ],
      "runtimeCommands": [
        "pnpm check:ci"
      ],
      "configKeys": [
        "RESEND_ENABLED",
        "RESEND_API_KEY",
        "RESEND_FROM_EMAIL"
      ]
    },
    {
      "id": "analytics-privacy",
      "title": "Analytics, privacy, and marketing",
      "owner": "analytics-core",
      "backendPanelRequired": true,
      "productionGateRequired": true,
      "humanChoiceRequired": true,
      "adminRoute": "/dashboard/analytics",
      "controlPanelSection": "growth",
      "profileControls": [
        "analytics_privacy_required"
      ],
      "evidenceFields": [
        "last_analytics_privacy_ref"
      ],
      "runtimeCommands": [
        "pnpm check:ci"
      ],
      "configKeys": [
        "ANALYTICS_ENABLED",
        "GA4_ENABLED",
        "NEXT_PUBLIC_ANALYTICS_REQUIRE_CONSENT",
        "NEXT_PUBLIC_PRIVACY_BANNER_ENABLED"
      ]
    },
    {
      "id": "discoverability-readiness",
      "title": "SEO, AEO, and GEO discoverability",
      "owner": "content-core",
      "backendPanelRequired": true,
      "productionGateRequired": true,
      "humanChoiceRequired": true,
      "adminRoute": "/dashboard/seo",
      "controlPanelSection": "growth",
      "profileControls": [
        "backend_control_panel_required"
      ],
      "evidenceFields": [
        "last_discoverability_readiness_ref"
      ],
      "runtimeCommands": [
        "pnpm check:ci"
      ],
      "configKeys": [
        "SEO_ENABLED",
        "SEO_INDEXING_ENABLED",
        "SEO_AI_CRAWLERS_ALLOWED",
        "SITE_CANONICAL_URL",
        "SEO_LANGUAGES"
      ]
    },
    {
      "id": "backup-rollback",
      "title": "Backup, restore, and rollback",
      "owner": "ops-control",
      "backendPanelRequired": true,
      "productionGateRequired": true,
      "humanChoiceRequired": true,
      "adminRoute": "/dashboard/ops",
      "controlPanelSection": "risk_system",
      "profileControls": [
        "backup_required",
        "restore_test_required",
        "rollback_required"
      ],
      "evidenceFields": [
        "last_backup_ref",
        "last_restore_test_ref",
        "last_rollback_ref"
      ],
      "runtimeCommands": [
        "pnpm deploy:vps-doctor"
      ],
      "configKeys": [
        "OPS_BACKUP_OFFSITE_ENABLED",
        "OPS_BACKUP_ENCRYPTION_ENABLED",
        "OPS_BACKUP_LAST_RESTORE_TEST_AT",
        "OPS_VPS_DOCTOR_ENABLED"
      ]
    },
    {
      "id": "ai-ops",
      "title": "AI operations",
      "owner": "ai-core",
      "backendPanelRequired": true,
      "productionGateRequired": true,
      "humanChoiceRequired": true,
      "adminRoute": "/dashboard/ai",
      "controlPanelSection": "intelligence",
      "profileControls": [
        "backend_control_panel_required"
      ],
      "evidenceFields": [
        "last_backend_control_panel_ref"
      ],
      "runtimeCommands": [
        "pnpm ai:doctor"
      ],
      "configKeys": [
        "AI_ENABLED",
        "AI_DEFAULT_PROVIDER",
        "AI_PROVIDER_CONFIGS_JSON",
        "OPS_AI_REVIEW_ENABLED",
        "OPS_AI_AUTO_REMEDIATE_ENABLED"
      ]
    }
  ]
} as const
