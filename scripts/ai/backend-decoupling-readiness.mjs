import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const policyPath = ".ai/backend-decoupling-readiness.json"
const sourceExtension = /\.(ts|tsx|mts|mjs|js|jsx|json)$/
const ignoredDirectories = new Set([
  ".git",
  ".next",
  "build",
  "coverage",
  "dist",
  "node_modules",
])

function normalizePath(value) {
  return value.split(path.sep).join("/")
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8")
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath))
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

function listFiles(relativePath) {
  const absolutePath = path.join(root, relativePath)

  if (!fs.existsSync(absolutePath)) {
    return []
  }

  const stat = fs.statSync(absolutePath)

  if (stat.isFile()) {
    return [normalizePath(relativePath)]
  }

  return fs.readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      return []
    }

    const child = normalizePath(path.join(relativePath, entry.name))

    if (entry.isDirectory()) {
      return listFiles(child)
    }

    return entry.isFile() ? [child] : []
  })
}

function sourceFiles(paths, options = {}) {
  const skipTests = options.skipTests !== false

  return paths
    .flatMap((entry) => listFiles(entry))
    .filter((file) => sourceExtension.test(file))
    .filter((file) => {
      if (!skipTests) {
        return true
      }

      return !file.includes("/__tests__/") && !/\.(test|spec)\./.test(file)
    })
    .sort()
}

function filesMatching(files, pattern) {
  return files.filter((file) => pattern.test(readText(file)))
}

function countMatches(files, pattern) {
  return files.reduce((count, file) => {
    const source = readText(file)
    return count + (source.match(pattern) || []).length
  }, 0)
}

function sample(values, limit = 20) {
  return values.slice(0, limit)
}

function createCheck({ id, status, value, max, target, message, details }) {
  return {
    id,
    status,
    value,
    max,
    target,
    message,
    details: details || {},
  }
}

function addHardCheck(input) {
  const { checks, issues, id, value, max, message, details } = input
  const status = value <= max ? "pass" : "fail"
  const check = createCheck({ id, status, value, max, target: max, message, details })

  checks.push(check)

  if (status === "fail") {
    issues.push({
      id,
      value,
      max,
      message,
      details: details || {},
    })
  }
}

function addBudgetCheck(input) {
  const { checks, issues, warnings, id, value, budget, message, details } = input
  const max = Number.isFinite(budget?.max) ? budget.max : 0
  const target = Number.isFinite(budget?.target) ? budget.target : 0
  const status = value > max ? "fail" : value > target ? "accepted-debt" : "pass"
  const check = createCheck({ id, status, value, max, target, message, details })

  checks.push(check)

  if (status === "fail") {
    issues.push({
      id,
      value,
      max,
      target,
      message,
      details: details || {},
    })
  } else if (status === "accepted-debt") {
    warnings.push({
      id,
      value,
      max,
      target,
      message: `${message} Current value is within the approved baseline but above the replacement target.`,
      details: {
        ...(details || {}),
        exit: budget?.exit,
      },
    })
  }
}

function scanRepository() {
  const backendFiles = sourceFiles([
    "apps/backend/src",
    "apps/backend/medusa-config.ts",
    "apps/backend/package.json",
  ])
  const backendApiFiles = sourceFiles(["apps/backend/src/api"])
  const backendModuleFiles = sourceFiles(["apps/backend/src/modules"])
  const platformCoreFiles = sourceFiles(["apps/backend/src/platform"])
  const adminBrowserFiles = sourceFiles([
    "apps/admin/src/components",
    "apps/admin/src/hooks",
  ])
  const adminUiFiles = sourceFiles([
    "apps/admin/src/components",
    "apps/admin/src/app/dashboard",
    "apps/admin/src/app/login",
    "apps/admin/src/app/page.tsx",
  ])
  const adminProductDtoUiFiles = sourceFiles([
    "apps/admin/src/components/products-view.tsx",
    "apps/admin/src/components/product-publishing-view.tsx",
    "apps/admin/src/components/credentials-view.tsx",
  ])
  const adminOrderCustomerDtoUiFiles = sourceFiles([
    "apps/admin/src/components/orders-view.tsx",
    "apps/admin/src/components/customers-view.tsx",
  ])
  const adminTransactionOpsDtoUiFiles = sourceFiles([
    "apps/admin/src/components/payments-view.tsx",
    "apps/admin/src/components/deliveries-view.tsx",
    "apps/admin/src/components/after-sales-view.tsx",
  ])
  const adminSupplierOpsDtoUiFiles = sourceFiles([
    "apps/admin/src/components/suppliers-view.tsx",
  ])
  const adminSeoOpsDtoUiFiles = sourceFiles([
    "apps/admin/src/components/seo-view.tsx",
  ])
  const adminObservabilityDtoUiFiles = sourceFiles([
    "apps/admin/src/components/analytics-view.tsx",
    "apps/admin/src/components/audit-logs-view.tsx",
  ])
  const adminSystemSettingsDtoUiFiles = sourceFiles([
    "apps/admin/src/components/system-settings-view.tsx",
  ])
  const adminAiOpsDtoUiFiles = sourceFiles([
    "apps/admin/src/components/ai-view.tsx",
    "apps/admin/src/components/ops-view.tsx",
  ])
  const adminMarketingDtoUiFiles = sourceFiles([
    "apps/admin/src/components/marketing-view.tsx",
  ])
  const adminContentDtoUiFiles = sourceFiles([
    "apps/admin/src/components/content-view.tsx",
  ])
  const storefrontFiles = sourceFiles(["apps/storefront/src"])
  const allowedStorefrontFetchFiles = new Set([
    "apps/storefront/src/lib/commerce-medusa.ts",
    "apps/storefront/src/lib/server-abuse-guard.ts",
    "apps/storefront/src/app/api/health/route.ts",
  ])

  const platformForbiddenMatches = platformCoreFiles.flatMap((file) => {
    const source = readText(file)
    const forbidden = [
      "@medusajs/",
      "../modules/",
      "../../modules/",
      "../platform-adapters/",
      "../../platform-adapters/",
    ].filter((text) => source.includes(text))

    return forbidden.map((text) => ({ path: file, forbiddenText: text }))
  })
  const adminDirectMedusaBrowserFiles = filesMatching(
    adminBrowserFiles,
    /ADMIN_MEDUSA_BACKEND_URL|NEXT_PUBLIC_MEDUSA|medusaBackendUrl|@\/lib\/medusa-admin/
  )
  const adminDirectAdminApiUiFiles = filesMatching(
    adminUiFiles,
    /from\s+["']@\/lib\/admin-api["']|from\s+["']\.\.\/lib\/admin-api["']/
  )
  const adminProductDtoLeakFiles = filesMatching(
    adminProductDtoUiFiles,
    /\b(product_variant_id|template_code|template_title|inventory_handler_code|delivery_handler_code|credential_inventory_supported|available_count|reserved_count|sold_count|total_count|sales_channels|created_at|updated_at|currency_code|display_label|account_identifier|delivered_at)\b/
  )
  const adminOrderCustomerDtoLeakFiles = filesMatching(
    adminOrderCustomerDtoUiFiles,
    /\b(display_id|payment_status|fulfillment_status|currency_code|payment_collections|unit_price|customer_groups|first_name|last_name|has_account|created_at|updated_at|delivered_at)\b/
  )
  const adminTransactionOpsDtoLeakFiles = filesMatching(
    adminTransactionOpsDtoUiFiles,
    /\b(delivery_id|account_item_id|display_label|account_identifier|product_variant_id|cart_id|order_id|payment_attempt_id|delivery_status|access_token_hint|delivered_by|delivered_at|buyer_confirmed_at|customer_email|admin_note|provider_code|provider_order_id|health_status|paid_at|created_at)\b/
  )
  const adminSupplierOpsDtoLeakFiles = filesMatching(
    adminSupplierOpsDtoUiFiles,
    /\b(supports_quote|supports_retrieve|supports_catalog_sync|product_variant_id|provider_code|provider_sku|provider_product_id|region_code|provider_order_id|order_id|payment_attempt_id|error_message|fulfilled_at|created_at)\b/
  )
  const adminSeoOpsDtoLeakFiles = filesMatching(
    adminSeoOpsDtoUiFiles,
    /\b(entity_type|entity_id|site_id|meta_title|meta_description|canonical_url|og_image_url|updated_at|average_score|performance_joined|site_url|provider_code)\b/
  )
  const adminObservabilityDtoLeakFiles = filesMatching(
    adminObservabilityDtoUiFiles,
    /\b(event_name|order_id|payment_attempt_id|created_at|event_id|destination_code|attempt_count|next_retry_at|delivered_at|error_message|actor_type|actor_id|entity_type|entity_id|risk_level|metadata_json|audit_logs)\b/
  )
  const adminSystemSettingsDtoLeakFiles = filesMatching(
    adminSystemSettingsDtoUiFiles,
    /\b(default_region_id|default_sales_channel_id|supported_currencies|currency_code|is_default|is_tax_inclusive|supported_locales|locale_code|first_name|last_name|created_at|iso_2|display_name|payment_providers|automatic_taxes|is_disabled|revoked_at|api_keys)\b/
  )
  const adminAiOpsDtoLeakFiles = filesMatching(
    adminAiOpsDtoUiFiles,
    /\b(provider_kind|base_url|default_model|api_key_env|api_key_configured|requires_api_key|task_type|required_capabilities|requires_human_review|plugin_code|provider_code|site_id|input_summary|output_summary|error_message|created_at|default_provider_code|task_plugins|task_runs|provider_count|configured_provider_count|attention_provider_count|review_run_count|recommended_action|human_gate|generated_at|critical_findings|warning_findings|human_gate_actions|control_panel_surface_count|gated_surface_count|launch_readiness|ai_ops)\b|\/admin\/ops-control/
  )
  const adminMarketingDtoLeakFiles = filesMatching(
    adminMarketingDtoUiFiles,
    /\b(starts_at|ends_at|created_at|discount_type|discount_value|max_redemptions|max_redemptions_per_email|redeemed_count|expires_at|max_uses|used_count|referrer_email|event_name|payment_attempt_id|order_id|coupon_code|referral_code)\b|Medusa\s+\/admin\/marketing/
  )
  const adminContentDtoLeakFiles = filesMatching(
    adminContentDtoUiFiles,
    /\b(site_id|content_format|content_type|cover_image_url|audio_url|reading_time_minutes|word_count|upload_strategy|default_provider_code|entry_id|asset_type|storage_provider|storage_provider_code|public_url|object_key|mime_type|alt_text|provider_code|created_at|task_type|provider_capability|review_status)\b|Medusa\s+\/admin\/content|\/admin\/content/
  )
  const storefrontFetchViolations = filesMatching(storefrontFiles, /\bfetch\s*\(/)
    .filter((file) => !allowedStorefrontFetchFiles.has(file))
  // Structural backstop: any snake_case property read (.foo_bar) in a browser
  // admin component or hook signals a backend response shape leaking past the
  // typed facade. Unlike the per-domain field denylists, this catches unknown
  // fields and newly added view files automatically. The facade in src/lib is
  // intentionally out of scope: it owns snake_case mapping.
  const adminSnakeCasePropertyFiles = filesMatching(
    adminBrowserFiles,
    /\.[a-z][a-z0-9]*(?:_[a-z0-9]+)+/
  )

  return {
    platformForbiddenMatches,
    adminDirectMedusaBrowserFiles,
    adminSnakeCasePropertyFiles,
    adminDirectAdminApiUiFiles,
    adminProductDtoLeakFiles,
    adminOrderCustomerDtoLeakFiles,
    adminTransactionOpsDtoLeakFiles,
    adminSupplierOpsDtoLeakFiles,
    adminSeoOpsDtoLeakFiles,
    adminObservabilityDtoLeakFiles,
    adminSystemSettingsDtoLeakFiles,
    adminAiOpsDtoLeakFiles,
    adminMarketingDtoLeakFiles,
    adminContentDtoLeakFiles,
    storefrontFetchViolations,
    backendMedusaImportFiles: filesMatching(backendFiles, /@medusajs\//),
    backendMedusaRequestResponseFiles: filesMatching(backendApiFiles, /MedusaRequest|MedusaResponse/),
    backendMedusaOrmFiles: filesMatching(backendModuleFiles, /model\.define|MedusaService|\bMigration\b/),
    adminMedusaRouteLiteralOccurrences: countMatches(
      adminUiFiles,
      /adminApi\s*\([\s\n]*[`'"]\/admin\//g
    ),
    adminMedusaRouteLiteralFiles: filesMatching(
      adminUiFiles,
      /adminApi\s*\([\s\n]*[`'"]\/admin\//
    ),
    storefrontMedusaEnvFiles: filesMatching(
      storefrontFiles,
      /NEXT_PUBLIC_MEDUSA|MEDUSA_BACKEND_URL|medusaBackendUrl/
    ),
  }
}

export function createBackendDecouplingReadinessReport() {
  const issues = []
  const warnings = []
  const checks = []
  let policy = null

  try {
    policy = readJson(policyPath)
  } catch (error) {
    issues.push({
      id: "backend-decoupling.policy-invalid",
      path: policyPath,
      message: error instanceof Error ? error.message : String(error),
    })
  }

  if (!exists(policyPath)) {
    issues.push({
      id: "backend-decoupling.policy-missing",
      path: policyPath,
      message: "Backend decoupling readiness policy is required.",
    })
  }

  if (policy) {
    for (const field of ["version", "objective", "currentBackend", "principles", "targetArchitecture", "baselines"]) {
      if (!policy[field]) {
        issues.push({
          id: "backend-decoupling.policy-field-missing",
          path: policyPath,
          field,
          message: "Backend decoupling policy is missing a required field.",
        })
      }
    }
  }

  const scan = scanRepository()
  const budgets = policy?.baselines?.budgets || {}

  addHardCheck({
    checks,
    issues,
    id: "platform-core-no-medusa-or-adapter-coupling",
    value: scan.platformForbiddenMatches.length,
    max: 0,
    message:
      "Platform core must stay framework-neutral and must not import Medusa, backend modules, or platform adapters.",
    details: {
      samples: sample(scan.platformForbiddenMatches),
    },
  })
  addHardCheck({
    checks,
    issues,
    id: "admin-browser-no-direct-medusa",
    value: scan.adminDirectMedusaBrowserFiles.length,
    max: 0,
    message: "Browser admin code must not read Medusa backend env, backend URL helpers, or server-only Medusa admin clients.",
    details: {
      files: sample(scan.adminDirectMedusaBrowserFiles),
    },
  })
  addHardCheck({
    checks,
    issues,
    id: "admin-ui-uses-product-admin-facade",
    value: scan.adminDirectAdminApiUiFiles.length,
    max: 0,
    message:
      "Admin browser UI must call the typed product-admin facade instead of importing the raw BFF helper.",
    details: {
      files: sample(scan.adminDirectAdminApiUiFiles),
    },
  })
  addHardCheck({
    checks,
    issues,
    id: "admin-product-domain-uses-product-dtos",
    value: scan.adminProductDtoLeakFiles.length,
    max: 0,
    message:
      "Product, publishing, and credential admin UI must consume product-admin DTOs instead of Medusa or backend snake_case response fields.",
    details: {
      files: sample(scan.adminProductDtoLeakFiles),
    },
  })
  addHardCheck({
    checks,
    issues,
    id: "admin-order-customer-domain-uses-product-dtos",
    value: scan.adminOrderCustomerDtoLeakFiles.length,
    max: 0,
    message:
      "Order and customer admin UI must consume product-admin DTOs instead of Medusa or backend snake_case response fields.",
    details: {
      files: sample(scan.adminOrderCustomerDtoLeakFiles),
    },
  })
  addHardCheck({
    checks,
    issues,
    id: "admin-transaction-ops-domain-uses-product-dtos",
    value: scan.adminTransactionOpsDtoLeakFiles.length,
    max: 0,
    message:
      "Payment, digital delivery, and after-sales admin UI must consume product-admin DTOs instead of Medusa or backend snake_case response fields.",
    details: {
      files: sample(scan.adminTransactionOpsDtoLeakFiles),
    },
  })
  addHardCheck({
    checks,
    issues,
    id: "admin-supplier-ops-domain-uses-product-dtos",
    value: scan.adminSupplierOpsDtoLeakFiles.length,
    max: 0,
    message:
      "Supplier admin UI must consume product-admin DTOs instead of supplier backend snake_case response fields.",
    details: {
      files: sample(scan.adminSupplierOpsDtoLeakFiles),
    },
  })
  addHardCheck({
    checks,
    issues,
    id: "admin-seo-ops-domain-uses-product-dtos",
    value: scan.adminSeoOpsDtoLeakFiles.length,
    max: 0,
    message:
      "SEO admin UI must consume product-admin DTOs instead of content backend snake_case response fields.",
    details: {
      files: sample(scan.adminSeoOpsDtoLeakFiles),
    },
  })
  addHardCheck({
    checks,
    issues,
    id: "admin-observability-domain-uses-product-dtos",
    value: scan.adminObservabilityDtoLeakFiles.length,
    max: 0,
    message:
      "Analytics and audit-log admin UI must consume product-admin DTOs instead of backend snake_case response fields.",
    details: {
      files: sample(scan.adminObservabilityDtoLeakFiles),
    },
  })
  addHardCheck({
    checks,
    issues,
    id: "admin-system-settings-domain-uses-product-dtos",
    value: scan.adminSystemSettingsDtoLeakFiles.length,
    max: 0,
    message:
      "System settings admin UI must consume product-admin DTOs instead of Medusa or backend snake_case response fields.",
    details: {
      files: sample(scan.adminSystemSettingsDtoLeakFiles),
    },
  })
  addHardCheck({
    checks,
    issues,
    id: "admin-ai-ops-domain-uses-product-dtos",
    value: scan.adminAiOpsDtoLeakFiles.length,
    max: 0,
    message:
      "AI and ops admin UI must consume product-admin DTOs instead of backend snake_case report fields or backend route literals.",
    details: {
      files: sample(scan.adminAiOpsDtoLeakFiles),
    },
  })
  addHardCheck({
    checks,
    issues,
    id: "admin-marketing-domain-uses-product-dtos",
    value: scan.adminMarketingDtoLeakFiles.length,
    max: 0,
    message:
      "Marketing admin UI must consume product-admin DTOs instead of backend snake_case response fields or Medusa route literals.",
    details: {
      files: sample(scan.adminMarketingDtoLeakFiles),
    },
  })
  addHardCheck({
    checks,
    issues,
    id: "admin-content-domain-uses-product-dtos",
    value: scan.adminContentDtoLeakFiles.length,
    max: 0,
    message:
      "Content admin UI must consume product-admin DTOs instead of content backend snake_case response fields or backend route literals.",
    details: {
      files: sample(scan.adminContentDtoLeakFiles),
    },
  })
  addHardCheck({
    checks,
    issues,
    id: "storefront-fetch-only-in-approved-adapters",
    value: scan.storefrontFetchViolations.length,
    max: 0,
    message: "Storefront UI must go through the commerce port; raw fetch calls are limited to approved adapter or health files.",
    details: {
      files: sample(scan.storefrontFetchViolations),
    },
  })
  addHardCheck({
    checks,
    issues,
    id: "admin-components-no-snake-case-property-reads",
    value: scan.adminSnakeCasePropertyFiles.length,
    max: 0,
    message:
      "Browser admin components and hooks must not read snake_case properties off backend records; consume camelCase product-admin DTOs from the facade instead. This catches any field and any new view file, not only the per-domain baseline.",
    details: {
      files: sample(scan.adminSnakeCasePropertyFiles),
    },
  })
  addBudgetCheck({
    checks,
    issues,
    warnings,
    id: "backend-medusa-import-budget",
    value: scan.backendMedusaImportFiles.length,
    budget: budgets.backendMedusaImportFiles,
    message: "Backend @medusajs/* import files must not grow beyond the local-development baseline.",
    details: {
      files: sample(scan.backendMedusaImportFiles),
    },
  })
  addBudgetCheck({
    checks,
    issues,
    warnings,
    id: "backend-medusa-api-runtime-budget",
    value: scan.backendMedusaRequestResponseFiles.length,
    budget: budgets.backendMedusaRequestResponseFiles,
    message: "MedusaRequest/MedusaResponse API handler usage must not grow beyond the local-development baseline.",
    details: {
      files: sample(scan.backendMedusaRequestResponseFiles),
    },
  })
  addBudgetCheck({
    checks,
    issues,
    warnings,
    id: "backend-medusa-orm-budget",
    value: scan.backendMedusaOrmFiles.length,
    budget: budgets.backendMedusaOrmFiles,
    message: "Medusa ORM/service/migration primitive usage must not grow beyond the local-development baseline.",
    details: {
      files: sample(scan.backendMedusaOrmFiles),
    },
  })
  addBudgetCheck({
    checks,
    issues,
    warnings,
    id: "admin-medusa-route-literal-budget",
    value: scan.adminMedusaRouteLiteralOccurrences,
    budget: budgets.adminMedusaRouteLiteralOccurrences,
    message: "Admin UI /admin/* route literals must not grow before the typed product-admin facade is introduced.",
    details: {
      files: sample(scan.adminMedusaRouteLiteralFiles),
    },
  })
  addBudgetCheck({
    checks,
    issues,
    warnings,
    id: "storefront-medusa-env-budget",
    value: scan.storefrontMedusaEnvFiles.length,
    budget: budgets.storefrontMedusaEnvFiles,
    message: "Storefront Medusa env references must stay confined to the current adapter and approved server probes.",
    details: {
      files: sample(scan.storefrontMedusaEnvFiles),
    },
  })

  const acceptedDebtCount = checks.filter((check) => check.status === "accepted-debt").length
  const failedCheckCount = checks.filter((check) => check.status === "fail").length

  return {
    ok: issues.length === 0 && failedCheckCount === 0,
    generatedAt: new Date().toISOString(),
    policy: {
      path: policyPath,
      version: policy?.version || null,
      currentBackend: policy?.currentBackend?.id || null,
      currentMaturity: policy?.currentMaturity || null,
    },
    summary: {
      checks: checks.length,
      failedChecks: failedCheckCount,
      acceptedDebtChecks: acceptedDebtCount,
      backendMedusaImportFiles: scan.backendMedusaImportFiles.length,
      backendMedusaRequestResponseFiles: scan.backendMedusaRequestResponseFiles.length,
      backendMedusaOrmFiles: scan.backendMedusaOrmFiles.length,
      adminMedusaRouteLiteralOccurrences: scan.adminMedusaRouteLiteralOccurrences,
      adminProductDtoLeakFiles: scan.adminProductDtoLeakFiles.length,
      adminOrderCustomerDtoLeakFiles: scan.adminOrderCustomerDtoLeakFiles.length,
      adminTransactionOpsDtoLeakFiles: scan.adminTransactionOpsDtoLeakFiles.length,
      adminSupplierOpsDtoLeakFiles: scan.adminSupplierOpsDtoLeakFiles.length,
      adminSeoOpsDtoLeakFiles: scan.adminSeoOpsDtoLeakFiles.length,
      adminObservabilityDtoLeakFiles: scan.adminObservabilityDtoLeakFiles.length,
      adminSystemSettingsDtoLeakFiles: scan.adminSystemSettingsDtoLeakFiles.length,
      adminAiOpsDtoLeakFiles: scan.adminAiOpsDtoLeakFiles.length,
      adminMarketingDtoLeakFiles: scan.adminMarketingDtoLeakFiles.length,
      adminContentDtoLeakFiles: scan.adminContentDtoLeakFiles.length,
      adminSnakeCasePropertyFiles: scan.adminSnakeCasePropertyFiles.length,
      storefrontMedusaEnvFiles: scan.storefrontMedusaEnvFiles.length,
    },
    checks,
    issueCount: issues.length,
    warningCount: warnings.length,
    issues,
    warnings,
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = createBackendDecouplingReadinessReport()

  console.log(JSON.stringify(report, null, 2))

  if (!report.ok) {
    process.exit(1)
  }
}
