"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useMemo, useState } from "react"
import { formatDate } from "@/lib/format"
import {
  createCatalogProduct,
  loadProductCatalog,
  type ProductAdminProductVariant,
  type ProductAdminStatus,
  updateCatalogProductStatus,
} from "@/lib/product-admin-api"
import {
  Field,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  TextAreaInput,
  TextInput,
} from "./admin-controls"
import { Message, MetricCard, PageHeader, Panel } from "./admin-page"
import { AdminTable, Cell, normalizeError } from "./admin-table"
import { StatusBadge } from "./status-badge"

type ProductForm = {
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

const EMPTY_PRODUCT_FORM: ProductForm = {
  title: "",
  handle: "",
  description: "",
  status: "draft",
  typeId: "",
  collectionId: "",
  categoryId: "",
  tagId: "",
  salesChannelId: "",
  variantTitle: "Default",
  sku: "",
  currencyCode: "usd",
  amount: "",
  manageInventory: false,
}

const PRODUCT_STATUSES: ProductAdminStatus[] = [
  "draft",
  "proposed",
  "published",
  "rejected",
]

export function ProductsView() {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState("")
  const [queryDraft, setQueryDraft] = useState("")
  const [form, setForm] = useState<ProductForm>(EMPTY_PRODUCT_FORM)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const productsQuery = useQuery({
    queryKey: ["products", query],
    queryFn: () => loadProductCatalog(query),
  })
  const data = productsQuery.data
  const products = useMemo(() => data?.products || [], [data?.products])

  const summary = useMemo(
    () =>
      products.reduce(
        (current, product) => {
          current.total += 1
          const status = String(product.status || "unknown")
          current[status] = (current[status] || 0) + 1
          return current
        },
        { total: 0 } as Record<string, number>,
      ),
    [products],
  )

  const createProduct = useMutation({
    mutationFn: () => {
      return createCatalogProduct(form)
    },
    onSuccess: async () => {
      setMessage("商品已创建。")
      setError("")
      setForm(EMPTY_PRODUCT_FORM)
      await queryClient.invalidateQueries({ queryKey: ["products"] })
    },
    onError: (err) => setError(normalizeError(err)),
  })

  const updateStatus = useMutation({
    mutationFn: (input: { id: string; status: ProductAdminStatus }) =>
      updateCatalogProductStatus(input),
    onSuccess: async () => {
      setMessage("商品状态已更新。")
      setError("")
      await queryClient.invalidateQueries({ queryKey: ["products"] })
    },
    onError: (err) => setError(normalizeError(err)),
  })

  const update = (patch: Partial<ProductForm>) =>
    setForm((current) => ({ ...current, ...patch }))

  return (
    <main className="px-5 py-5">
      <PageHeader
        title="商品"
        description="独立后台商品控制面，覆盖商品列表、基础创建、状态切换、分类集合和销售渠道上下文。浏览器只调用同源 BFF。"
        action={
          <SecondaryButton
            type="button"
            onClick={() => void productsQuery.refetch()}
          >
            刷新
          </SecondaryButton>
        }
      />

      <section className="mb-4 grid gap-3 md:grid-cols-4">
        <MetricCard label="商品" value={summary.total} detail="当前查询" />
        <MetricCard label="已发布" value={summary.published || 0} detail="published" />
        <MetricCard label="草稿" value={summary.draft || 0} detail="draft" />
        <MetricCard
          label="销售渠道"
          value={data?.salesChannels.length || 0}
          detail="sales channels"
        />
      </section>

      <div className="mb-4 grid gap-2">
        {error ? <Message tone="error">{error}</Message> : null}
        {message ? <Message tone="info">{message}</Message> : null}
        {productsQuery.error ? (
          <Message tone="error">{productsQuery.error.message}</Message>
        ) : null}
        {productsQuery.isLoading ? <Message tone="info">加载中</Message> : null}
      </div>

      <div className="grid gap-4">
        <Panel title="筛选">
          <form
            className="flex flex-col gap-3 md:flex-row md:items-end"
            onSubmit={(event) => {
              event.preventDefault()
              setQuery(queryDraft)
            }}
          >
            <div className="min-w-0 flex-1">
              <Field label="搜索">
                <TextInput
                  value={queryDraft}
                  onChange={(event) => setQueryDraft(event.target.value)}
                  placeholder="标题、handle、SKU"
                />
              </Field>
            </div>
            <div className="flex gap-2">
              <PrimaryButton type="submit">应用</PrimaryButton>
              <SecondaryButton
                type="button"
                onClick={() => {
                  setQuery("")
                  setQueryDraft("")
                }}
              >
                清空
              </SecondaryButton>
            </div>
          </form>
        </Panel>

        <Panel title="新建商品">
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              setMessage("")
              void createProduct.mutate()
            }}
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label="标题">
                <TextInput
                  value={form.title}
                  onChange={(event) => update({ title: event.target.value })}
                />
              </Field>
              <Field label="handle">
                <TextInput
                  value={form.handle}
                  onChange={(event) => update({ handle: event.target.value })}
                  placeholder="留空自动生成"
                />
              </Field>
              <Field label="状态">
                <SelectInput
                  value={form.status}
                  onChange={(event) =>
                    update({ status: event.target.value as ProductAdminStatus })
                  }
                >
                  {PRODUCT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="销售渠道">
                <SelectInput
                  value={form.salesChannelId}
                  onChange={(event) =>
                    update({ salesChannelId: event.target.value })
                  }
                >
                  <option value="">不指定</option>
                  {data?.salesChannels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="集合">
                <SelectInput
                  value={form.collectionId}
                  onChange={(event) => update({ collectionId: event.target.value })}
                >
                  <option value="">不指定</option>
                  {data?.collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.title}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="分类">
                <SelectInput
                  value={form.categoryId}
                  onChange={(event) => update({ categoryId: event.target.value })}
                >
                  <option value="">不指定</option>
                  {data?.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="类型">
                <SelectInput
                  value={form.typeId}
                  onChange={(event) => update({ typeId: event.target.value })}
                >
                  <option value="">不指定</option>
                  {data?.productTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.value}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="标签">
                <SelectInput
                  value={form.tagId}
                  onChange={(event) => update({ tagId: event.target.value })}
                >
                  <option value="">不指定</option>
                  {data?.tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.value}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>
            <Field label="描述">
              <TextAreaInput
                value={form.description}
                onChange={(event) => update({ description: event.target.value })}
              />
            </Field>
            <div className="grid gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text)]">
                  默认变体
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  填写价格时会同时创建一个 Default 变体；留空则只创建商品壳。
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <Field label="变体标题">
                  <TextInput
                    value={form.variantTitle}
                    onChange={(event) =>
                      update({ variantTitle: event.target.value })
                    }
                  />
                </Field>
                <Field label="SKU">
                  <TextInput
                    value={form.sku}
                    onChange={(event) => update({ sku: event.target.value })}
                  />
                </Field>
                <Field label="币种">
                  <TextInput
                    value={form.currencyCode}
                    onChange={(event) =>
                      update({ currencyCode: event.target.value })
                    }
                  />
                </Field>
                <Field label="价格金额">
                  <TextInput
                    type="number"
                    min="0"
                    step="1"
                    value={form.amount}
                    onChange={(event) => update({ amount: event.target.value })}
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                  <input
                    type="checkbox"
                    checked={form.manageInventory}
                    onChange={(event) =>
                      update({ manageInventory: event.target.checked })
                    }
                  />
                  管理库存
                </label>
              </div>
            </div>
            <div>
              <PrimaryButton type="submit" disabled={createProduct.isPending}>
                {createProduct.isPending ? "创建中" : "创建商品"}
              </PrimaryButton>
            </div>
          </form>
        </Panel>

        <Panel title="商品列表">
          <AdminTable
            headers={["商品", "状态", "变体", "渠道", "更新时间", "操作"]}
            empty={!productsQuery.isLoading && products.length === 0}
          >
            {products.map((product) => (
              <tr key={product.id} className="align-top">
                <Cell>
                  <div className="font-medium">{product.title}</div>
                  <div className="font-mono text-xs text-[var(--muted)]">
                    {product.handle || product.id}
                  </div>
                </Cell>
                <Cell>
                  <StatusBadge value={product.status} />
                </Cell>
                <Cell>
                  <div className="grid gap-1">
                    {product.variants.slice(0, 3).map((variant) => (
                      <div key={variant.id}>
                        <span className="font-medium">
                          {variant.title || variant.sku || variant.id}
                        </span>
                        <span className="ml-2 text-xs text-[var(--muted)]">
                          {variant.sku || "-"} · {priceLabel(variant)}
                        </span>
                      </div>
                    ))}
                    {product.variants.length > 3 ? (
                      <span className="text-xs text-[var(--muted)]">
                        +{product.variants.length - 3} more
                      </span>
                    ) : null}
                  </div>
                </Cell>
                <Cell>
                  {product.salesChannels.map((channel) => channel.name).join(", ") ||
                    "-"}
                </Cell>
                <Cell>{formatDate(product.updatedAt || product.createdAt)}</Cell>
                <Cell align="right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link
                      href={`/dashboard/product-publishing?product_id=${product.id}`}
                      className="min-h-9 border border-[var(--border)] bg-white px-3 text-sm font-medium leading-9 hover:bg-[var(--surface-muted)]"
                    >
                      发布状态
                    </Link>
                    <SecondaryButton
                      type="button"
                      disabled={
                        updateStatus.isPending ||
                        product.status === "published"
                      }
                      onClick={() =>
                        updateStatus.mutate({
                          id: product.id,
                          status: "published",
                        })
                      }
                    >
                      发布
                    </SecondaryButton>
                    <SecondaryButton
                      type="button"
                      disabled={updateStatus.isPending || product.status === "draft"}
                      onClick={() =>
                        updateStatus.mutate({ id: product.id, status: "draft" })
                      }
                    >
                      转草稿
                    </SecondaryButton>
                  </div>
                </Cell>
              </tr>
            ))}
          </AdminTable>
        </Panel>
      </div>
    </main>
  )
}

function priceLabel(variant: ProductAdminProductVariant) {
  const price = variant.prices?.[0]

  if (!price || typeof price.amount !== "number") {
    return "无价格"
  }

  return `${price.currencyCode || "-"} ${price.amount}`
}
