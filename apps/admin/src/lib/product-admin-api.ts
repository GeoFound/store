import { adminApi } from "./admin-api"

export type ProductAdminOrderAction = "complete" | "archive" | "cancel"

export type ProductAdminStatus = "draft" | "proposed" | "published" | "rejected"

export type ProductAdminPrice = {
  currencyCode: string | null
  amount: number | null
}

export type ProductAdminProductVariant = {
  id: string
  title: string | null
  sku: string | null
  managesInventory: boolean
  allowsBackorder: boolean
  prices: ProductAdminPrice[]
}

export type ProductAdminSalesChannel = {
  id: string
  name: string
  isDisabled: boolean
}

export type ProductAdminProduct = {
  id: string
  title: string
  handle: string | null
  status: ProductAdminStatus | string
  thumbnail: string | null
  variants: ProductAdminProductVariant[]
  salesChannels: ProductAdminSalesChannel[]
  createdAt: string | null
  updatedAt: string | null
}

export type ProductAdminCategory = {
  id: string
  name: string
  handle: string | null
  isActive: boolean
}

export type ProductAdminCollection = {
  id: string
  title: string
  handle: string | null
}

export type ProductAdminProductType = {
  id: string
  value: string
}

export type ProductAdminTag = {
  id: string
  value: string
}

export type ProductCatalogWorkspace = {
  products: ProductAdminProduct[]
  count: number
  categories: ProductAdminCategory[]
  collections: ProductAdminCollection[]
  productTypes: ProductAdminProductType[]
  tags: ProductAdminTag[]
  salesChannels: ProductAdminSalesChannel[]
}

export type ProductAdminTemplate = {
  code: string
  title: string
  description: string
  productType: string
  fulfillmentPolicyCode: string | null
  deliveryHandlerCode: string | null
  inventoryHandlerCode: string | null
}

export type ProductAdminCatalogVariant = {
  id: string
  title: string | null
  sku: string | null
  productId: string | null
  productTitle: string | null
  productHandle: string | null
  productType: string | null
  templateCode: string
  templateTitle: string
  inventoryHandlerCode: string
  deliveryHandlerCode: string | null
  credentialInventorySupported: boolean
  availabilitySupported: boolean
  totalCount: number | null
  availableCount: number | null
  reservedCount: number | null
  soldCount: number | null
  lockedCount: number | null
  isInStock: boolean | null
}

export type ProductAdminCredentialItem = {
  id: string
  productVariantId: string
  status: string
  displayLabel: string
  accountIdentifier: string
  orderId: string | null
  cartId: string | null
  deliveredAt: string | null
}

export type ProductAdminCredentialBatch = {
  id: string
  name: string
  productVariantId: string
  status: string
  totalCount: number
  availableCount: number
  reservedCount: number
  soldCount: number
}

export type CredentialInventoryWorkspace = {
  items: ProductAdminCredentialItem[]
  batches: ProductAdminCredentialBatch[]
  templates: ProductAdminTemplate[]
  variants: ProductAdminCatalogVariant[]
}

export type ProductAdminOrderLineItem = {
  id: string
  title: string | null
  subtitle: string | null
  quantity: number | null
  unitPrice: number | null
  total: number | null
}

export type ProductAdminOrderCustomer = {
  id: string | null
  email: string | null
  firstName: string | null
  lastName: string | null
}

export type ProductAdminPaymentCollection = {
  id: string
  status: string | null
  amount: number | null
}

export type ProductAdminFulfillment = {
  id: string
  status: string | null
  deliveredAt: string | null
}

export type ProductAdminOrder = {
  id: string
  displayId: number | string | null
  email: string | null
  status: string | null
  paymentStatus: string | null
  fulfillmentStatus: string | null
  total: number | null
  currencyCode: string | null
  customer: ProductAdminOrderCustomer | null
  items: ProductAdminOrderLineItem[]
  paymentCollections: ProductAdminPaymentCollection[]
  fulfillments: ProductAdminFulfillment[]
  createdAt: string | null
  updatedAt: string | null
}

export type ProductAdminOrderList = {
  orders: ProductAdminOrder[]
  count: number
}

export type ProductAdminCustomer = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  hasAccount: boolean
  groups: ProductAdminCustomerGroup[]
  createdAt: string | null
  updatedAt: string | null
}

export type ProductAdminCustomerGroup = {
  id: string
  name: string
  createdAt: string | null
}

export type ProductAdminCustomerWorkspace = {
  customers: ProductAdminCustomer[]
  count: number
  groups: ProductAdminCustomerGroup[]
}

type CreateCatalogProductInput = {
  title: string
  handle: string
  description: string
  status: ProductAdminStatus
  typeId: string
  collectionId: string
  categoryId: string
  tagId: string
  salesChannelId: string
  variantTitle: string
  sku: string
  currencyCode: string
  amount: string
  manageInventory: boolean
}

type CreateCustomerInput = {
  email: string
  firstName: string
  lastName: string
  phone: string
}

type SaveSupplierMappingInput = {
  productVariantId: string
  providerCode: string
  providerSku: string
  providerProductId: string
  regionCode: string
  currency: string
  priority: string
  metadata: string
}

type ImportCredentialBatchInput = {
  name: string
  productVariantId: string
  templateCode: string
  items: Array<{
    accountIdentifier?: string
    displayLabel?: string
    credential: Record<string, unknown> | string
  }>
}

type ReserveCredentialInput = {
  productVariantId: string
  quantity: string
  reservationKey: string
  cartId: string
  orderId: string
  ttlSeconds: string
}

type SeoDocumentInput = {
  entityType: string
  entityId: string
  siteId: string
  language: string
  metaTitle: string
  metaDescription: string
  canonicalUrl: string
  ogImageUrl: string
  status: string
}

type SeoSuggestionInput = {
  entityType: string
  entityId: string
  siteId: string
  language: string
  providerCode: string
  model: string
}

type ContentFilters = {
  siteId: string
  status: string
}

type ContentEntryInput = {
  siteId: string
  title: string
  slug: string
  excerpt: string
  body: string
  contentFormat: string
  contentType: string
  status: string
  authorName: string
  coverImageUrl: string
  language: string
  topic: string
  tags: string
  relatedProductHandles: string
  aiAssisted: boolean
}

type ContentAssetInput = {
  siteId: string
  entryId: string
  assetType: string
  storageProviderCode: string
  filename: string
  publicUrl: string
  objectKey: string
  mimeType: string
  altText: string
}

type ContentAiTaskInput = {
  siteId: string
  entryId: string
  taskType: string
  providerCapability: string
  providerCode: string
  model: string
  inputSummary: string
}

type ContentEntryRecord = {
  id: string
  site_id: string
  title: string
}

type ContentAssetRecord = {
  id: string
  site_id: string
  entry_id?: string | null
}

type StorageProviderRecord = {
  code: string
  kind?: string | null
}

type PaymentChannelRecord = {
  id: string
  enabled: boolean
}

type DeliveryInput = {
  deliveryId: string
  accountItemId: string
  orderId: string
  cartId: string
  paymentAttemptId: string
  deliveredBy: string
  deliveryNote: string
  deliveryPayload: unknown
}

type MarketingCampaignInput = {
  code: string
  name: string
  status: string
}

type MarketingCouponInput = {
  code: string
  status: string
  maxRedemptions: string
}

type MarketingReferralInput = {
  code: string
  referrerEmail: string
  maxUses: string
}

const PRODUCT_FIELDS =
  "id,title,handle,status,thumbnail,variants.id,variants.title,variants.sku,variants.manage_inventory,variants.allow_backorder,variants.prices.*,sales_channels.id,sales_channels.name,created_at,updated_at"

const ORDER_FIELDS =
  "id,display_id,email,status,payment_status,fulfillment_status,total,currency_code,customer.*,items.*,payment_collections.*,fulfillments.*,created_at,updated_at"

const TASK_CAPABILITY_DEFAULTS: Record<string, string> = {
  article_outline: "text.generate",
  article_draft: "text.generate",
  article_rewrite: "text.generate",
  seo: "text.generate",
  summary: "text.generate",
  readability: "text.generate",
  fact_check: "text.generate",
  translation: "text.generate",
  tts: "speech.tts",
  stt: "speech.stt",
}

export async function loadProductCatalog(
  query: string,
): Promise<ProductCatalogWorkspace> {
  const params = new URLSearchParams({
    limit: "50",
    fields: PRODUCT_FIELDS,
  })

  if (query.trim()) {
    params.set("q", query.trim())
  }

  const [
    products,
    categories,
    collections,
    productTypes,
    tags,
    salesChannels,
  ] = await Promise.all([
    adminApi<{ products: unknown[]; count?: number }>(
      `/admin/products?${params.toString()}`,
    ),
    adminApi<{ product_categories: unknown[] }>(
      "/admin/product-categories?limit=100",
    ).catch(() => ({ product_categories: [] })),
    adminApi<{ collections: unknown[] }>("/admin/collections?limit=100").catch(
      () => ({ collections: [] }),
    ),
    adminApi<{ product_types: unknown[] }>("/admin/product-types?limit=100").catch(
      () => ({ product_types: [] }),
    ),
    adminApi<{ product_tags: unknown[] }>("/admin/product-tags?limit=100").catch(
      () => ({ product_tags: [] }),
    ),
    adminApi<{ sales_channels: unknown[] }>(
      "/admin/sales-channels?limit=100",
    ).catch(() => ({ sales_channels: [] })),
  ])

  return {
    products: arrayField(products.products)
      .map(toProductAdminProduct)
      .filter((product) => product.id),
    count: products.count || products.products?.length || 0,
    categories: arrayField(categories.product_categories)
      .map(toProductAdminCategory)
      .filter((category) => category.id),
    collections: arrayField(collections.collections)
      .map(toProductAdminCollection)
      .filter((collection) => collection.id),
    productTypes: arrayField(productTypes.product_types)
      .map(toProductAdminProductType)
      .filter((type) => type.id),
    tags: arrayField(tags.product_tags)
      .map(toProductAdminTag)
      .filter((tag) => tag.id),
    salesChannels: arrayField(salesChannels.sales_channels)
      .map(toProductAdminSalesChannel)
      .filter((channel) => channel.id),
  }
}

export function createCatalogProduct(input: CreateCatalogProductInput) {
  if (!input.title.trim()) {
    throw new Error("商品标题必填。")
  }

  const payload: Record<string, unknown> = {
    title: input.title.trim(),
    description: emptyToNull(input.description),
    status: input.status,
  }
  const handle = input.handle.trim() || slugFromTitle(input.title)
  const amount = Number(input.amount)

  if (handle) {
    payload.handle = handle
  }
  if (input.typeId) {
    payload.type_id = input.typeId
  }
  if (input.collectionId) {
    payload.collection_id = input.collectionId
  }
  if (input.categoryId) {
    payload.categories = [{ id: input.categoryId }]
  }
  if (input.tagId) {
    payload.tags = [{ id: input.tagId }]
  }
  if (input.salesChannelId) {
    payload.sales_channels = [{ id: input.salesChannelId }]
  }
  if (input.variantTitle.trim() || input.sku.trim() || input.amount.trim()) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("创建变体时价格金额必须是大于 0 的数字。")
    }

    payload.options = [{ title: "Default", values: ["Default"] }]
    payload.variants = [
      {
        title: input.variantTitle.trim() || "Default",
        sku: input.sku.trim() || null,
        manage_inventory: input.manageInventory,
        options: { Default: "Default" },
        prices: [
          {
            currency_code: input.currencyCode.trim().toLowerCase() || "usd",
            amount,
          },
        ],
      },
    ]
  }

  return adminApi("/admin/products", {
    method: "POST",
    body: payload,
  })
}

export function updateCatalogProductStatus(input: {
  id: string
  status: ProductAdminStatus
}) {
  return adminApi(`/admin/products/${input.id}`, {
    method: "POST",
    body: { status: input.status },
  })
}

export async function loadOrders(query: string): Promise<ProductAdminOrderList> {
  const params = new URLSearchParams({
    limit: "50",
    order: "-created_at",
    fields: ORDER_FIELDS,
  })

  if (query.trim()) {
    params.set("q", query.trim())
  }

  const data = await adminApi<{ orders: unknown[]; count?: number }>(
    `/admin/orders?${params.toString()}`,
  )

  return {
    orders: arrayField(data.orders)
      .map(toProductAdminOrder)
      .filter((order) => order.id),
    count: data.count || data.orders?.length || 0,
  }
}

export async function retrieveOrder(orderId: string): Promise<ProductAdminOrder> {
  const data = await adminApi<{ order: unknown }>(
    `/admin/orders/${orderId}?fields=${ORDER_FIELDS}`,
  )

  return toProductAdminOrder(data.order)
}

export function runOrderAction(input: {
  orderId: string
  action: ProductAdminOrderAction
  note?: string
}) {
  const noteBody =
    input.note?.trim() && input.action !== "archive"
      ? { metadata: { operator_note: input.note.trim() } }
      : undefined

  return adminApi(`/admin/orders/${input.orderId}/${input.action}`, {
    method: "POST",
    ...(noteBody ? { body: noteBody } : {}),
  })
}

export async function loadCustomers(
  query: string,
): Promise<ProductAdminCustomerWorkspace> {
  const params = new URLSearchParams({
    limit: "100",
    fields:
      "id,email,first_name,last_name,phone,has_account,groups.id,groups.name,created_at,updated_at",
  })

  if (query.trim()) {
    params.set("q", query.trim())
  }

  const [customers, groups] = await Promise.all([
    adminApi<{ customers: unknown[]; count?: number }>(
      `/admin/customers?${params.toString()}`,
    ),
    adminApi<{ customer_groups: unknown[] }>(
      "/admin/customer-groups?limit=100",
    ).catch(() => ({ customer_groups: [] })),
  ])

  return {
    customers: arrayField(customers.customers)
      .map(toProductAdminCustomer)
      .filter((customer) => customer.id),
    count: customers.count || customers.customers?.length || 0,
    groups: arrayField(groups.customer_groups)
      .map(toProductAdminCustomerGroup)
      .filter((group) => group.id),
  }
}

export function createCustomer(input: CreateCustomerInput) {
  if (!input.email.trim()) {
    throw new Error("邮箱必填。")
  }

  const body: Record<string, string> = {
    email: input.email.trim(),
  }
  if (input.firstName.trim()) {
    body.first_name = input.firstName.trim()
  }
  if (input.lastName.trim()) {
    body.last_name = input.lastName.trim()
  }
  if (input.phone.trim()) {
    body.phone = input.phone.trim()
  }

  return adminApi("/admin/customers", {
    method: "POST",
    body,
  })
}

export async function loadSystemSettings() {
  const [
    stores,
    users,
    regions,
    salesChannels,
    apiKeys,
    featureFlags,
    plugins,
  ] = await Promise.all([
    adminApi<{ stores: unknown[] }>("/admin/stores?limit=20").catch(() => ({
      stores: [],
    })),
    adminApi<{ users: unknown[] }>("/admin/users?limit=100").catch(() => ({
      users: [],
    })),
    adminApi<{ regions: unknown[] }>("/admin/regions?limit=100").catch(() => ({
      regions: [],
    })),
    adminApi<{ sales_channels: unknown[] }>(
      "/admin/sales-channels?limit=100",
    ).catch(() => ({ sales_channels: [] })),
    adminApi<{ api_keys: unknown[] }>("/admin/api-keys?limit=100").catch(() => ({
      api_keys: [],
    })),
    adminApi<{ feature_flags?: unknown[]; flags?: unknown[] }>(
      "/admin/feature-flags",
    ).catch((): { feature_flags?: unknown[]; flags?: unknown[] } => ({
      feature_flags: [],
    })),
    adminApi<{ plugins?: unknown[] }>("/admin/plugins").catch(() => ({
      plugins: [],
    })),
  ])

  return {
    stores: stores.stores || [],
    users: users.users || [],
    regions: regions.regions || [],
    salesChannels: salesChannels.sales_channels || [],
    apiKeys: apiKeys.api_keys || [],
    featureFlags: featureFlags.feature_flags || featureFlags.flags || [],
    plugins: plugins.plugins || [],
  }
}

export function updateStoreName(input: { storeId: string; name: string }) {
  if (!input.storeId) {
    throw new Error("没有可更新的 store。")
  }
  if (!input.name.trim()) {
    throw new Error("store 名称必填。")
  }

  return adminApi(`/admin/stores/${input.storeId}`, {
    method: "POST",
    body: { name: input.name.trim() },
  })
}

export function loadAIProviders() {
  return adminApi("/admin/ai/providers")
}

export function loadAIPolicy() {
  return adminApi("/admin/ai/control-panel-policy")
}

export function loadAIRuns() {
  return adminApi("/admin/ai/runs?limit=50")
}

export function loadAuditLogs(query: string) {
  return adminApi(`/admin/audit-logs?${query}`)
}

export async function loadDeliveryWorkspace() {
  const [pendingData, deliveryData] = await Promise.all([
    adminApi<{ items: unknown[] }>("/admin/digital-delivery/pending"),
    adminApi<{ deliveries: unknown[] }>("/admin/digital-delivery/deliveries"),
  ])

  return {
    pending: pendingData.items || [],
    deliveries: deliveryData.deliveries || [],
  }
}

export function createDigitalDelivery(input: DeliveryInput) {
  return adminApi<{ delivery: { id: string }; accessToken: string | null }>(
    "/admin/digital-delivery/deliveries",
    {
      method: "POST",
      body: {
        delivery_id: emptyToUndefined(input.deliveryId),
        account_item_id: emptyToUndefined(input.accountItemId),
        order_id: emptyToUndefined(input.orderId),
        cart_id: emptyToUndefined(input.cartId),
        payment_attempt_id: emptyToUndefined(input.paymentAttemptId),
        delivery_payload: input.deliveryPayload,
        delivered_by: input.deliveredBy.trim() || "admin",
        delivery_note: emptyToUndefined(input.deliveryNote),
      },
    },
  )
}

export function loadOpsDashboard() {
  return adminApi("/admin/ops-control/dashboard")
}

export function loadOpsSecurity() {
  return adminApi("/admin/ops-control/security")
}

export function loadOpsMaintenance() {
  return adminApi("/admin/ops-control/maintenance")
}

export async function loadMarketingWorkspace() {
  const [campaignData, offerData, couponData, referralData, touchpointData] =
    await Promise.all([
      adminApi<{ campaigns: unknown[] }>("/admin/marketing/campaigns?limit=50"),
      adminApi<{ offers: unknown[] }>("/admin/marketing/offers?limit=50"),
      adminApi<{ coupons: unknown[] }>("/admin/marketing/coupons?limit=50"),
      adminApi<{ referral_links: unknown[] }>(
        "/admin/marketing/referral-links?limit=50",
      ),
      adminApi<{ touchpoints: unknown[] }>(
        "/admin/marketing/touchpoints?limit=100",
      ),
    ])

  return {
    campaigns: campaignData.campaigns || [],
    offers: offerData.offers || [],
    coupons: couponData.coupons || [],
    referralLinks: referralData.referral_links || [],
    touchpoints: touchpointData.touchpoints || [],
  }
}

export function createMarketingCampaign(input: MarketingCampaignInput) {
  return adminApi("/admin/marketing/campaigns", {
    method: "POST",
    body: {
      code: input.code.trim(),
      name: input.name.trim(),
      status: input.status,
    },
  })
}

export function createMarketingCoupon(input: MarketingCouponInput) {
  return adminApi("/admin/marketing/coupons", {
    method: "POST",
    body: {
      code: input.code.trim(),
      status: input.status,
      max_redemptions: optionalNonNegativeNumber(input.maxRedemptions),
    },
  })
}

export function createMarketingReferral(input: MarketingReferralInput) {
  return adminApi("/admin/marketing/referral-links", {
    method: "POST",
    body: {
      code: input.code.trim(),
      referrer_email: emptyToNull(input.referrerEmail),
      max_uses: optionalNonNegativeNumber(input.maxUses),
      status: "active",
    },
  })
}

export async function loadProductPublishingWorkspace(): Promise<{
  templates: ProductAdminTemplate[]
  variants: ProductAdminCatalogVariant[]
}> {
  const [templateData, variantData] = await Promise.all([
    adminApi<{ templates: unknown[] }>("/admin/product-templates"),
    adminApi<{ variants: unknown[] }>("/admin/catalog/variants"),
  ])

  return {
    templates: arrayField(templateData.templates)
      .map(toProductAdminTemplate)
      .filter((template) => template.code),
    variants: arrayField(variantData.variants)
      .map(toProductAdminCatalogVariant)
      .filter((variant) => variant.id),
  }
}

export function createSalesChannel(input: {
  name: string
  description: string
  isDisabled: boolean
}) {
  if (!input.name.trim()) {
    throw new Error("销售渠道名称必填。")
  }

  return adminApi("/admin/sales-channels", {
    method: "POST",
    body: {
      name: input.name.trim(),
      description: emptyToNull(input.description),
      is_disabled: input.isDisabled,
    },
  })
}

export async function loadCredentialInventory(): Promise<CredentialInventoryWorkspace> {
  const [itemsData, batchesData, templateData, catalogData] = await Promise.all([
    adminApi<{ items: unknown[] }>("/admin/credential-inventory/items"),
    adminApi<{ batches: unknown[] }>("/admin/credential-inventory/batches"),
    adminApi<{ templates: unknown[] }>("/admin/product-templates"),
    adminApi<{ variants: unknown[] }>("/admin/catalog/variants"),
  ])

  return {
    items: arrayField(itemsData.items)
      .map(toProductAdminCredentialItem)
      .filter((item) => item.id),
    batches: arrayField(batchesData.batches)
      .map(toProductAdminCredentialBatch)
      .filter((batch) => batch.id),
    templates: arrayField(templateData.templates)
      .map(toProductAdminTemplate)
      .filter((template) => template.code),
    variants: arrayField(catalogData.variants)
      .map(toProductAdminCatalogVariant)
      .filter((variant) => variant.id),
  }
}

export function importCredentialBatch(input: ImportCredentialBatchInput) {
  return adminApi("/admin/credential-inventory/batches", {
    method: "POST",
    body: {
      name: input.name.trim() || "手动导入",
      product_variant_id: input.productVariantId.trim(),
      template_code: input.templateCode.trim(),
      items: input.items.map((item) => ({
        account_identifier: item.accountIdentifier,
        display_label: item.displayLabel,
        credential: item.credential,
      })),
    },
  })
}

export function reserveCredentials(input: ReserveCredentialInput) {
  const body: Record<string, string | number> = {
    product_variant_id: input.productVariantId.trim(),
    quantity: Number(input.quantity) || 1,
    reservation_key: input.reservationKey.trim(),
    ttl_seconds: Number(input.ttlSeconds) || 900,
  }
  if (input.cartId.trim()) {
    body.cart_id = input.cartId.trim()
  }
  if (input.orderId.trim()) {
    body.order_id = input.orderId.trim()
  }

  return adminApi("/admin/credential-inventory/reservations", {
    method: "POST",
    body,
  })
}

export function releaseCredentialReservation(reservationKey: string) {
  return adminApi(
    `/admin/credential-inventory/reservations/${encodeURIComponent(
      reservationKey.trim(),
    )}/release`,
    { method: "POST" },
  )
}

export function sellCredentialReservation(input: {
  reservationKey: string
  orderId?: string
}) {
  return adminApi(
    `/admin/credential-inventory/reservations/${encodeURIComponent(
      input.reservationKey.trim(),
    )}/sell`,
    {
      method: "POST",
      body: input.orderId?.trim() ? { order_id: input.orderId.trim() } : {},
    },
  )
}

export async function loadSeoWorkspace() {
  const emptyAudit = {
    summary: {
      documents: 0,
      critical: 0,
      warning: 0,
      info: 0,
      average_score: 100,
    },
    results: [],
    performance_joined: false,
  }
  const [documentsData, auditData] = await Promise.all([
    adminApi<{ documents: unknown[] }>("/admin/content/seo?limit=200"),
    adminApi<typeof emptyAudit>("/admin/content/seo/audit").catch(
      () => emptyAudit,
    ),
  ])

  return {
    documents: documentsData.documents || [],
    audit: auditData || emptyAudit,
  }
}

export function loadSeoPerformance() {
  return adminApi(
    "/admin/content/seo/performance?dimension=page&limit=25",
  )
}

export function upsertSeoDocument(input: SeoDocumentInput) {
  return adminApi("/admin/content/seo", {
    method: "POST",
    body: {
      entity_type: input.entityType,
      entity_id: input.entityId.trim(),
      site_id: emptyToNull(input.siteId),
      language: emptyToNull(input.language),
      meta_title: emptyToNull(input.metaTitle),
      meta_description: emptyToNull(input.metaDescription),
      canonical_url: emptyToNull(input.canonicalUrl),
      og_image_url: emptyToNull(input.ogImageUrl),
      status: input.status,
    },
  })
}

export function suggestSeoDocument(input: SeoSuggestionInput) {
  return adminApi<Record<string, unknown>>("/admin/content/seo/suggest", {
    method: "POST",
    body: {
      entity_type: input.entityType,
      entity_id: input.entityId.trim(),
      site_id: emptyToNull(input.siteId),
      language: emptyToNull(input.language),
      provider_code: emptyToNull(input.providerCode),
      model: emptyToNull(input.model),
    },
  })
}

export function loadAnalyticsEvents() {
  return adminApi<{ events: unknown[] }>("/admin/analytics/events?limit=100")
}

export function loadAnalyticsDispatches() {
  return adminApi<{ dispatches: unknown[] }>(
    "/admin/analytics/dispatches?limit=100",
  )
}

export function replayAnalyticsDispatch(dispatchId: string) {
  return adminApi("/admin/analytics/dispatches", {
    method: "POST",
    body: { dispatch_id: dispatchId },
  })
}

export async function loadSupplierWorkspace() {
  const [providerData, mappingData, procurementData] = await Promise.all([
    adminApi<{ providers: unknown[] }>("/admin/suppliers/providers"),
    adminApi<{ mappings: unknown[] }>("/admin/suppliers/mappings?limit=100"),
    adminApi<{ procurements: unknown[] }>(
      "/admin/suppliers/procurements?limit=100",
    ),
  ])

  return {
    providers: providerData.providers || [],
    mappings: mappingData.mappings || [],
    procurements: procurementData.procurements || [],
  }
}

export function saveSupplierMapping(input: SaveSupplierMappingInput) {
  return adminApi<{ mapping: { id: string } }>("/admin/suppliers/mappings", {
    method: "POST",
    body: {
      product_variant_id: input.productVariantId.trim(),
      provider_code: input.providerCode.trim(),
      provider_sku: input.providerSku.trim(),
      provider_product_id: emptyToUndefined(input.providerProductId),
      region_code: emptyToUndefined(input.regionCode),
      currency: emptyToUndefined(input.currency),
      enabled: true,
      priority: optionalFiniteNumber(input.priority, 100),
      metadata: parseOptionalJson(input.metadata),
    },
  })
}

export function retrySupplierProcurement(id: string) {
  return adminApi(`/admin/suppliers/procurements/${id}/retry`, {
    method: "POST",
  })
}

export async function loadAfterSales() {
  const data = await adminApi<{ after_sales: unknown[] }>("/admin/after-sales")
  return data.after_sales || []
}

export function updateAfterSale(input: {
  id: string
  status: string
  result: string
  adminNote: string
}) {
  return adminApi(`/admin/after-sales/${input.id}`, {
    method: "POST",
    body: {
      status: input.status,
      result: input.result,
      admin_note: input.adminNote,
    },
  })
}

export async function loadPaymentWorkspace() {
  const [channelData, attemptData] = await Promise.all([
    adminApi<{ channels: unknown[] }>("/admin/payment-channels"),
    adminApi<{ attempts: unknown[] }>("/admin/payment-attempts?limit=100"),
  ])

  return {
    channels: channelData.channels || [],
    attempts: attemptData.attempts || [],
  }
}

export function createManualPaymentChannel(input: {
  code: string
  name: string
}) {
  return adminApi<{ channel: unknown }>("/admin/payment-channels", {
    method: "POST",
    body: {
      code: input.code.trim(),
      name: input.name.trim(),
      display_name: input.name.trim(),
      type: "manual",
      provider_code: input.code.trim(),
    },
  })
}

export function togglePaymentChannel(channel: PaymentChannelRecord) {
  return adminApi<{ channel: unknown }>(`/admin/payment-channels/${channel.id}`, {
    method: "POST",
    body: {
      enabled: !channel.enabled,
    },
  })
}

export function markPaymentAttemptPaid(input: {
  attemptId: string
  note: string
}) {
  return adminApi(`/admin/payment-attempts/${input.attemptId}/mark-paid`, {
    method: "POST",
    body: {
      note: emptyToNull(input.note),
    },
  })
}

export async function loadContentWorkspace(filters: ContentFilters) {
  const query = new URLSearchParams({ limit: "100" })
  if (filters.siteId) {
    query.set("site_id", filters.siteId)
  }
  if (filters.status) {
    query.set("status", filters.status)
  }

  const [entries, storage, assets, audio, tasks] = await Promise.all([
    adminApi<{ entries: unknown[] }>(
      `/admin/content/entries?${query.toString()}`,
    ),
    adminApi<{
      default_provider_code: string
      providers: StorageProviderRecord[]
      issues: string[]
    }>("/admin/content/storage/providers"),
    adminApi<{ assets: unknown[] }>("/admin/content/assets?limit=25"),
    adminApi<{ audio: unknown[] }>("/admin/content/audio?limit=25"),
    adminApi<{ tasks: unknown[] }>("/admin/content/ai/tasks?limit=25"),
  ])

  return {
    entries: entries.entries || [],
    storage: storage || { default_provider_code: "local", providers: [], issues: [] },
    assets: assets.assets || [],
    audio: audio.audio || [],
    tasks: tasks.tasks || [],
  }
}

export function createContentEntry(input: ContentEntryInput) {
  return adminApi("/admin/content/entries", {
    method: "POST",
    body: {
      site_id: input.siteId,
      title: input.title.trim(),
      slug: input.slug.trim() || slugFromTitle(input.title),
      excerpt: emptyToNull(input.excerpt),
      body: emptyToNull(input.body),
      content_format: input.contentFormat,
      content_type: input.contentType,
      status: input.status,
      author_name: emptyToNull(input.authorName),
      cover_image_url: emptyToNull(input.coverImageUrl),
      language: emptyToNull(input.language),
      topic: emptyToNull(input.topic),
      tags: input.tags,
      related_product_handles: input.relatedProductHandles,
      ai_assisted: input.aiAssisted,
    },
  })
}

export function createContentAsset(input: {
  form: ContentAssetInput
  provider?: StorageProviderRecord | null
}) {
  return adminApi("/admin/content/assets", {
    method: "POST",
    body: {
      site_id: input.form.siteId,
      entry_id: emptyToNull(input.form.entryId),
      asset_type: input.form.assetType,
      storage_provider: input.provider?.kind,
      storage_provider_code: emptyToNull(input.form.storageProviderCode),
      public_url: emptyToNull(input.form.publicUrl),
      object_key: emptyToNull(input.form.objectKey),
      mime_type: emptyToNull(input.form.mimeType),
      alt_text: emptyToNull(input.form.altText),
    },
  })
}

export function createContentUploadPolicy(input: ContentAssetInput) {
  return adminApi<{ upload: unknown }>("/admin/content/assets/upload-policy", {
    method: "POST",
    body: {
      site_id: emptyToNull(input.siteId),
      entry_id: emptyToNull(input.entryId),
      asset_type: input.assetType,
      storage_provider_code: emptyToNull(input.storageProviderCode),
      filename: input.filename.trim() || input.objectKey.trim() || null,
      mime_type: emptyToNull(input.mimeType),
      expires_in_seconds: 900,
    },
  })
}

export function createContentAiTask(input: ContentAiTaskInput) {
  return adminApi("/admin/content/ai/tasks", {
    method: "POST",
    body: {
      site_id: input.siteId,
      entry_id: emptyToNull(input.entryId),
      task_type: input.taskType,
      provider_code: emptyToNull(input.providerCode),
      provider_capability:
        input.providerCapability.trim() ||
        TASK_CAPABILITY_DEFAULTS[input.taskType] ||
        "text.generate",
      model: emptyToNull(input.model),
      status: "queued",
      review_status: "pending",
      input_summary: emptyToNull(input.inputSummary),
    },
  })
}

export function runContentAiTask(input: ContentAiTaskInput) {
  return adminApi("/admin/content/ai/run", {
    method: "POST",
    body: {
      site_id: input.siteId,
      entry_id: emptyToNull(input.entryId),
      task_type: input.taskType,
      provider_code: emptyToNull(input.providerCode),
      model: emptyToNull(input.model),
      input_summary: emptyToNull(input.inputSummary),
      input: { source: "admin_content_view" },
    },
  })
}

export function updateContentEntryStatus(input: { id: string; status: string }) {
  return adminApi(`/admin/content/entries/${input.id}`, {
    method: "POST",
    body: { status: input.status },
  })
}

export async function publishContentEntrySnapshot(entry: { id: string }) {
  const data = await adminApi<{ revision: { id: string } }>(
    `/admin/content/entries/${entry.id}/revisions`,
    {
      method: "POST",
      body: { status: "review", change_note: "Admin publish snapshot" },
    },
  )

  return adminApi(`/admin/content/revisions/${data.revision.id}/publish`, {
    method: "POST",
    body: { channel: "storefront" },
  })
}

export function queueContentEntryTask(input: {
  entry: ContentEntryRecord
  taskType: string
}) {
  return adminApi("/admin/content/ai/tasks", {
    method: "POST",
    body: {
      site_id: input.entry.site_id,
      entry_id: input.entry.id,
      task_type: input.taskType,
      provider_capability:
        TASK_CAPABILITY_DEFAULTS[input.taskType] || "text.generate",
      status: "queued",
      review_status: "pending",
      input_summary: `${input.taskType}: ${input.entry.title}`,
    },
  })
}

export async function registerContentAudioFromAsset(asset: ContentAssetRecord) {
  await adminApi("/admin/content/audio", {
    method: "POST",
    body: {
      site_id: asset.site_id,
      entry_id: asset.entry_id,
      asset_id: asset.id,
      status: "ready",
      metadata: { source: "admin_asset_registration" },
    },
  })

  return adminApi(`/admin/content/entries/${asset.entry_id}`, {
    method: "POST",
    body: { audio_asset_id: asset.id },
  })
}

export function updateContentTaskReview(input: {
  taskId: string
  reviewStatus: string
}) {
  return adminApi(`/admin/content/ai/tasks/${input.taskId}`, {
    method: "POST",
    body: {
      review_status: input.reviewStatus,
      output_summary: `Admin review marked ${input.reviewStatus}`,
    },
  })
}

function toProductAdminProduct(value: unknown): ProductAdminProduct {
  const record = recordField(value)

  return {
    id: stringField(record.id),
    title: stringField(record.title, "Untitled product"),
    handle: nullableStringField(record.handle),
    status: stringField(record.status, "draft"),
    thumbnail: nullableStringField(record.thumbnail),
    variants: arrayField(record.variants)
      .map(toProductAdminProductVariant)
      .filter((variant) => variant.id),
    salesChannels: arrayField(record.sales_channels)
      .map(toProductAdminSalesChannel)
      .filter((channel) => channel.id),
    createdAt: nullableStringField(record.created_at),
    updatedAt: nullableStringField(record.updated_at),
  }
}

function toProductAdminProductVariant(
  value: unknown,
): ProductAdminProductVariant {
  const record = recordField(value)

  return {
    id: stringField(record.id),
    title: nullableStringField(record.title),
    sku: nullableStringField(record.sku),
    managesInventory: booleanField(record.manage_inventory),
    allowsBackorder: booleanField(record.allow_backorder),
    prices: arrayField(record.prices).map(toProductAdminPrice),
  }
}

function toProductAdminPrice(value: unknown): ProductAdminPrice {
  const record = recordField(value)

  return {
    currencyCode: nullableStringField(record.currency_code),
    amount: nullableNumberField(record.amount),
  }
}

function toProductAdminCategory(value: unknown): ProductAdminCategory {
  const record = recordField(value)

  return {
    id: stringField(record.id),
    name: stringField(record.name, stringField(record.handle, "Unnamed category")),
    handle: nullableStringField(record.handle),
    isActive: booleanField(record.is_active, true),
  }
}

function toProductAdminCollection(value: unknown): ProductAdminCollection {
  const record = recordField(value)

  return {
    id: stringField(record.id),
    title: stringField(record.title, stringField(record.handle, "Untitled collection")),
    handle: nullableStringField(record.handle),
  }
}

function toProductAdminProductType(value: unknown): ProductAdminProductType {
  const record = recordField(value)

  return {
    id: stringField(record.id),
    value: stringField(record.value, stringField(record.id)),
  }
}

function toProductAdminTag(value: unknown): ProductAdminTag {
  const record = recordField(value)

  return {
    id: stringField(record.id),
    value: stringField(record.value, stringField(record.id)),
  }
}

function toProductAdminSalesChannel(value: unknown): ProductAdminSalesChannel {
  const record = recordField(value)

  return {
    id: stringField(record.id),
    name: stringField(record.name, stringField(record.id)),
    isDisabled: booleanField(record.is_disabled),
  }
}

function toProductAdminTemplate(value: unknown): ProductAdminTemplate {
  const record = recordField(value)

  return {
    code: stringField(record.code),
    title: stringField(record.title, stringField(record.code, "Untitled template")),
    description: stringField(record.description),
    productType: stringField(record.productType, stringField(record.product_type)),
    fulfillmentPolicyCode: nullableStringField(
      record.fulfillmentPolicyCode ?? record.fulfillment_policy_code,
    ),
    deliveryHandlerCode: nullableStringField(
      record.deliveryHandlerCode ?? record.delivery_handler_code,
    ),
    inventoryHandlerCode: nullableStringField(
      record.inventoryHandlerCode ?? record.inventory_handler_code,
    ),
  }
}

function toProductAdminCatalogVariant(
  value: unknown,
): ProductAdminCatalogVariant {
  const record = recordField(value)

  return {
    id: stringField(record.id),
    title: nullableStringField(record.title),
    sku: nullableStringField(record.sku),
    productId: nullableStringField(record.product_id),
    productTitle: nullableStringField(record.product_title),
    productHandle: nullableStringField(record.product_handle),
    productType: nullableStringField(record.product_type),
    templateCode: stringField(record.template_code),
    templateTitle: stringField(record.template_title, stringField(record.template_code)),
    inventoryHandlerCode: stringField(record.inventory_handler_code, "unknown"),
    deliveryHandlerCode: nullableStringField(record.delivery_handler_code),
    credentialInventorySupported: booleanField(
      record.credential_inventory_supported,
    ),
    availabilitySupported: booleanField(record.availability_supported),
    totalCount: nullableNumberField(record.total_count),
    availableCount: nullableNumberField(record.available_count),
    reservedCount: nullableNumberField(record.reserved_count),
    soldCount: nullableNumberField(record.sold_count),
    lockedCount: nullableNumberField(record.locked_count),
    isInStock:
      typeof record.is_in_stock === "boolean" ? record.is_in_stock : null,
  }
}

function toProductAdminCredentialItem(
  value: unknown,
): ProductAdminCredentialItem {
  const record = recordField(value)

  return {
    id: stringField(record.id),
    productVariantId: stringField(record.product_variant_id),
    status: stringField(record.status, "unknown"),
    displayLabel: stringField(record.display_label, stringField(record.id)),
    accountIdentifier: stringField(record.account_identifier),
    orderId: nullableStringField(record.order_id),
    cartId: nullableStringField(record.cart_id),
    deliveredAt: nullableStringField(record.delivered_at),
  }
}

function toProductAdminCredentialBatch(
  value: unknown,
): ProductAdminCredentialBatch {
  const record = recordField(value)

  return {
    id: stringField(record.id),
    name: stringField(record.name, stringField(record.id)),
    productVariantId: stringField(record.product_variant_id),
    status: stringField(record.status, "unknown"),
    totalCount: numberField(record.total_count),
    availableCount: numberField(record.available_count),
    reservedCount: numberField(record.reserved_count),
    soldCount: numberField(record.sold_count),
  }
}

function toProductAdminOrder(value: unknown): ProductAdminOrder {
  const record = recordField(value)
  const customer = record.customer ? toProductAdminOrderCustomer(record.customer) : null

  return {
    id: stringField(record.id),
    displayId: displayIdField(record.display_id),
    email: nullableStringField(record.email),
    status: nullableStringField(record.status),
    paymentStatus: nullableStringField(record.payment_status),
    fulfillmentStatus: nullableStringField(record.fulfillment_status),
    total: nullableNumberField(record.total),
    currencyCode: nullableStringField(record.currency_code),
    customer,
    items: arrayField(record.items)
      .map(toProductAdminOrderLineItem)
      .filter((item) => item.id),
    paymentCollections: arrayField(record.payment_collections)
      .map(toProductAdminPaymentCollection)
      .filter((collection) => collection.id),
    fulfillments: arrayField(record.fulfillments)
      .map(toProductAdminFulfillment)
      .filter((fulfillment) => fulfillment.id),
    createdAt: nullableStringField(record.created_at),
    updatedAt: nullableStringField(record.updated_at),
  }
}

function toProductAdminOrderLineItem(
  value: unknown,
): ProductAdminOrderLineItem {
  const record = recordField(value)

  return {
    id: stringField(record.id),
    title: nullableStringField(record.title),
    subtitle: nullableStringField(record.subtitle),
    quantity: nullableNumberField(record.quantity),
    unitPrice: nullableNumberField(record.unit_price),
    total: nullableNumberField(record.total),
  }
}

function toProductAdminOrderCustomer(
  value: unknown,
): ProductAdminOrderCustomer {
  const record = recordField(value)

  return {
    id: nullableStringField(record.id),
    email: nullableStringField(record.email),
    firstName: nullableStringField(record.first_name),
    lastName: nullableStringField(record.last_name),
  }
}

function toProductAdminPaymentCollection(
  value: unknown,
): ProductAdminPaymentCollection {
  const record = recordField(value)

  return {
    id: stringField(record.id),
    status: nullableStringField(record.status),
    amount: nullableNumberField(record.amount),
  }
}

function toProductAdminFulfillment(value: unknown): ProductAdminFulfillment {
  const record = recordField(value)

  return {
    id: stringField(record.id),
    status: nullableStringField(record.status),
    deliveredAt: nullableStringField(record.delivered_at),
  }
}

function toProductAdminCustomer(value: unknown): ProductAdminCustomer {
  const record = recordField(value)

  return {
    id: stringField(record.id),
    email: stringField(record.email),
    firstName: nullableStringField(record.first_name),
    lastName: nullableStringField(record.last_name),
    phone: nullableStringField(record.phone),
    hasAccount: booleanField(record.has_account),
    groups: arrayField(record.groups)
      .map(toProductAdminCustomerGroup)
      .filter((group) => group.id),
    createdAt: nullableStringField(record.created_at),
    updatedAt: nullableStringField(record.updated_at),
  }
}

function toProductAdminCustomerGroup(
  value: unknown,
): ProductAdminCustomerGroup {
  const record = recordField(value)

  return {
    id: stringField(record.id),
    name: stringField(record.name, stringField(record.id)),
    createdAt: nullableStringField(record.created_at),
  }
}

function recordField(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function arrayField(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function stringField(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback
}

function nullableStringField(value: unknown) {
  return typeof value === "string" ? value : null
}

function booleanField(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback
}

function numberField(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function nullableNumberField(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function displayIdField(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? value : null
}

function emptyToNull(value: string) {
  return value.trim() || null
}

function emptyToUndefined(value: string) {
  return value.trim() || undefined
}

function optionalFiniteNumber(value: string, fallback: number) {
  if (!value.trim()) {
    return fallback
  }

  const numeric = Number(value)

  if (!Number.isFinite(numeric)) {
    throw new Error("priority 必须是有效数字。")
  }

  return numeric
}

function optionalNonNegativeNumber(value: string) {
  if (!value.trim()) {
    return null
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("请输入有效的非负数字。")
  }

  return parsed
}

function parseOptionalJson(value: string) {
  const normalized = value.trim()
  if (!normalized) {
    return undefined
  }

  const parsed = JSON.parse(normalized) as unknown

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("metadata 必须是 JSON object。")
  }

  return parsed as Record<string, unknown>
}

function slugFromTitle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
