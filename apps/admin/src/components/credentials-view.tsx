"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState, type ReactNode } from "react"
import { formatDate } from "@/lib/format"
import {
  importCredentialBatch,
  loadCredentialInventory,
  releaseCredentialReservation,
  reserveCredentials as reserveCredentialItems,
  sellCredentialReservation,
} from "@/lib/product-admin-api"
import {
  Field,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  TextAreaInput,
  TextInput,
} from "./admin-controls"
import { Message, MetricCard, PageHeader, Panel, TableShell } from "./admin-page"
import { StatusBadge } from "./status-badge"

type AccountItem = {
  id: string
  product_variant_id: string
  status: string
  display_label: string
  account_identifier: string
  order_id?: string | null
  cart_id?: string | null
  delivered_at?: string | null
}

type Batch = {
  id: string
  name: string
  product_variant_id: string
  status: string
  total_count: number
  available_count: number
  reserved_count: number
  sold_count: number
}

type ProductTemplate = {
  code: string
  title: string
  description: string
  productType: string
}

type CatalogVariant = {
  id: string
  title: string | null
  sku: string | null
  product_title: string | null
  product_handle: string | null
  product_id: string | null
  template_code: string
  template_title: string
  inventory_handler_code: string
  delivery_handler_code: string | null
  credential_inventory_supported: boolean
  available_count: number | null
  reserved_count: number | null
  sold_count: number | null
  total_count: number | null
}

type ImportItem = {
  account_identifier?: string
  display_label?: string
  credential: Record<string, unknown> | string
}

const SAMPLE_IMPORT = `demo1----secret1
demo2,secret2
CARD-AAAA-BBBB-CCCC`

async function loadCredentials() {
  return loadCredentialInventory() as Promise<{
    items: AccountItem[]
    batches: Batch[]
    templates: ProductTemplate[]
    variants: CatalogVariant[]
  }>
}

export function CredentialsView() {
  const queryClient = useQueryClient()
  const [name, setName] = useState("手动导入")
  const [productVariantId, setProductVariantId] = useState("")
  const [templateCode, setTemplateCode] = useState("credential")
  const [credentialsText, setCredentialsText] = useState(SAMPLE_IMPORT)
  const [reservationForm, setReservationForm] = useState({
    productVariantId: "",
    quantity: "1",
    reservationKey: "",
    cartId: "",
    orderId: "",
    ttlSeconds: "900",
  })
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const credentialsQuery = useQuery({
    queryKey: ["credentials"],
    queryFn: loadCredentials,
  })
  const data = credentialsQuery.data

  const selectedVariant = useMemo(
    () =>
      data?.variants.find((variant) => variant.id === productVariantId.trim()) ||
      null,
    [data?.variants, productVariantId],
  )

  function selectVariant(value: string) {
    setProductVariantId(value)
    const variant = data?.variants.find((item) => item.id === value.trim())
    if (variant?.template_code) {
      setTemplateCode(variant.template_code)
    }
  }

  const importBatch = useMutation({
    mutationFn: async () => {
      const normalizedVariant = productVariantId.trim()

      if (!normalizedVariant) {
        throw new Error("请选择或填写商品变体。")
      }

      if (selectedVariant && !selectedVariant.credential_inventory_supported) {
        throw new Error("该变体不支持凭证库存。")
      }

      const items = parseCredentialLines(credentialsText)

      return importCredentialBatch({
        name,
        productVariantId: normalizedVariant,
        templateCode,
        items,
      })
    },
    onSuccess: async () => {
      setMessage("凭证已导入。")
      setError("")
      await queryClient.invalidateQueries({ queryKey: ["credentials"] })
    },
    onError: (err) => setError(errorMessage(err)),
  })

  const reserveCredentials = useMutation({
    mutationFn: async () => {
      if (!reservationForm.productVariantId.trim()) {
        throw new Error("预约需要商品变体 ID。")
      }
      if (!reservationForm.reservationKey.trim()) {
        throw new Error("预约需要 reservation_key。")
      }

      return reserveCredentialItems(reservationForm)
    },
    onSuccess: async () => {
      setMessage("凭证已预约。")
      setError("")
      await queryClient.invalidateQueries({ queryKey: ["credentials"] })
    },
    onError: (err) => setError(errorMessage(err)),
  })

  const releaseReservation = useMutation({
    mutationFn: () => {
      if (!reservationForm.reservationKey.trim()) {
        throw new Error("释放需要 reservation_key。")
      }

      return releaseCredentialReservation(reservationForm.reservationKey)
    },
    onSuccess: async () => {
      setMessage("预约已释放。")
      setError("")
      await queryClient.invalidateQueries({ queryKey: ["credentials"] })
    },
    onError: (err) => setError(errorMessage(err)),
  })

  const sellReservation = useMutation({
    mutationFn: () => {
      if (!reservationForm.reservationKey.trim()) {
        throw new Error("标记售出需要 reservation_key。")
      }

      return sellCredentialReservation({
        reservationKey: reservationForm.reservationKey,
        orderId: reservationForm.orderId,
      })
    },
    onSuccess: async () => {
      setMessage("预约已标记售出。")
      setError("")
      await queryClient.invalidateQueries({ queryKey: ["credentials"] })
    },
    onError: (err) => setError(errorMessage(err)),
  })

  return (
    <main className="px-5 py-5">
      <PageHeader
        title="凭证库存"
        description="导入并管理数字凭证批次。导入经由同源 BFF 转发到 Medusa，明文凭证仅在提交时传输。"
        action={
          <SecondaryButton
            type="button"
            onClick={() => void credentialsQuery.refetch()}
          >
            刷新
          </SecondaryButton>
        }
      />

      <section className="mb-4 grid gap-3 md:grid-cols-4">
        <MetricCard
          label="批次"
          value={data?.batches.length || 0}
          detail="batches"
        />
        <MetricCard
          label="凭证项"
          value={data?.items.length || 0}
          detail="account items"
        />
        <MetricCard
          label="可用"
          value={sumField(data?.batches, "available_count")}
          detail="available"
        />
        <MetricCard
          label="已售"
          value={sumField(data?.batches, "sold_count")}
          detail="sold"
        />
      </section>

      <div className="mb-4 grid gap-2">
        {error ? <Message tone="error">{error}</Message> : null}
        {message ? <Message tone="info">{message}</Message> : null}
        {credentialsQuery.error ? (
          <Message tone="error">{credentialsQuery.error.message}</Message>
        ) : null}
        {credentialsQuery.isLoading ? <Message tone="info">加载中</Message> : null}
      </div>

      <div className="grid gap-4">
        <Panel title="导入凭证批次">
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              setMessage("")
              void importBatch.mutate()
            }}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="批次名称">
                <TextInput
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <Field label="商品变体（目录）">
                <SelectInput
                  value={
                    data?.variants.some((v) => v.id === productVariantId)
                      ? productVariantId
                      : ""
                  }
                  onChange={(event) => selectVariant(event.target.value)}
                >
                  <option value="">选择商品变体</option>
                  {data?.variants.map((variant) => (
                    <option
                      key={variant.id}
                      value={variant.id}
                      disabled={!variant.credential_inventory_supported}
                    >
                      {variantLabel(variant)}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="变体 ID（手动）">
                <TextInput
                  value={productVariantId}
                  onChange={(event) => selectVariant(event.target.value)}
                  placeholder="variant_..."
                />
              </Field>
              <Field label="template_code">
                <TextInput
                  value={templateCode}
                  onChange={(event) => setTemplateCode(event.target.value)}
                  placeholder="credential"
                />
              </Field>
            </div>

            {selectedVariant ? (
              <Message tone="info">{variantSummary(selectedVariant)}</Message>
            ) : null}

            {data?.templates.length ? (
              <div className="grid gap-2 md:grid-cols-2">
                {data.templates.map((template) => (
                  <button
                    key={template.code}
                    type="button"
                    onClick={() => setTemplateCode(template.code)}
                    className={
                      templateCode === template.code
                        ? "border border-[var(--accent)] bg-[var(--surface-muted)] px-3 py-3 text-left"
                        : "border border-[var(--border)] bg-white px-3 py-3 text-left hover:bg-[var(--surface-muted)]"
                    }
                  >
                    <div className="text-sm font-medium">{template.title}</div>
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      {template.description}
                    </div>
                    <div className="mt-2 font-mono text-xs text-[var(--muted)]">
                      {template.code} / {template.productType}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            <Field label="凭证（每行一条，支持 ---- , | : 制表符分隔，或 JSON）">
              <TextAreaInput
                value={credentialsText}
                onChange={(event) => setCredentialsText(event.target.value)}
                className="min-h-40 font-mono"
              />
            </Field>

            <div className="flex flex-wrap gap-2">
              <PrimaryButton type="submit" disabled={importBatch.isPending}>
                {importBatch.isPending ? "导入中" : "导入凭证"}
              </PrimaryButton>
              <SecondaryButton
                type="button"
                onClick={() => void credentialsQuery.refetch()}
              >
                刷新
              </SecondaryButton>
            </div>
          </form>
        </Panel>

        <Panel title="批次">
          <AdminTable
            headers={["名称", "变体", "状态", "数量（可用/预留/已售/总）"]}
            empty={!credentialsQuery.isLoading && (data?.batches.length || 0) === 0}
          >
            {data?.batches.map((batch) => (
              <tr key={batch.id} className="align-top">
                <Cell>{batch.name}</Cell>
                <Cell mono>{batch.product_variant_id}</Cell>
                <Cell>
                  <StatusBadge value={batch.status} />
                </Cell>
                <Cell>
                  {batch.available_count} / {batch.reserved_count} /{" "}
                  {batch.sold_count} / {batch.total_count}
                </Cell>
              </tr>
            ))}
          </AdminTable>
        </Panel>

        <Panel
          title="预约 / 释放 / 售出"
          description="用于验证和处理凭证库存锁。释放和售出按 reservation_key 执行，避免误操作。"
        >
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              setMessage("")
              void reserveCredentials.mutate()
            }}
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Field label="商品变体">
                <SelectInput
                  value={
                    data?.variants.some(
                      (variant) => variant.id === reservationForm.productVariantId,
                    )
                      ? reservationForm.productVariantId
                      : ""
                  }
                  onChange={(event) =>
                    setReservationForm((current) => ({
                      ...current,
                      productVariantId: event.target.value,
                    }))
                  }
                >
                  <option value="">选择商品变体</option>
                  {data?.variants.map((variant) => (
                    <option
                      key={variant.id}
                      value={variant.id}
                      disabled={!variant.credential_inventory_supported}
                    >
                      {variantLabel(variant)}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="变体 ID（手动）">
                <TextInput
                  value={reservationForm.productVariantId}
                  onChange={(event) =>
                    setReservationForm((current) => ({
                      ...current,
                      productVariantId: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="reservation_key">
                <TextInput
                  value={reservationForm.reservationKey}
                  onChange={(event) =>
                    setReservationForm((current) => ({
                      ...current,
                      reservationKey: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="quantity">
                <TextInput
                  type="number"
                  min="1"
                  value={reservationForm.quantity}
                  onChange={(event) =>
                    setReservationForm((current) => ({
                      ...current,
                      quantity: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="cart_id">
                <TextInput
                  value={reservationForm.cartId}
                  onChange={(event) =>
                    setReservationForm((current) => ({
                      ...current,
                      cartId: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="order_id">
                <TextInput
                  value={reservationForm.orderId}
                  onChange={(event) =>
                    setReservationForm((current) => ({
                      ...current,
                      orderId: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="ttl_seconds">
                <TextInput
                  type="number"
                  min="60"
                  value={reservationForm.ttlSeconds}
                  onChange={(event) =>
                    setReservationForm((current) => ({
                      ...current,
                      ttlSeconds: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <PrimaryButton type="submit" disabled={reserveCredentials.isPending}>
                {reserveCredentials.isPending ? "预约中" : "预约凭证"}
              </PrimaryButton>
              <SecondaryButton
                type="button"
                disabled={releaseReservation.isPending}
                onClick={() => {
                  setMessage("")
                  void releaseReservation.mutate()
                }}
              >
                {releaseReservation.isPending ? "释放中" : "释放预约"}
              </SecondaryButton>
              <SecondaryButton
                type="button"
                disabled={sellReservation.isPending}
                onClick={() => {
                  setMessage("")
                  void sellReservation.mutate()
                }}
              >
                {sellReservation.isPending ? "标记中" : "标记售出"}
              </SecondaryButton>
            </div>
          </form>
        </Panel>

        <Panel title="凭证项">
          <AdminTable
            headers={["标签", "状态", "变体", "订单", "交付时间"]}
            empty={!credentialsQuery.isLoading && (data?.items.length || 0) === 0}
          >
            {data?.items.map((item) => (
              <tr key={item.id} className="align-top">
                <Cell>
                  <div className="font-medium">{item.display_label}</div>
                  <div className="font-mono text-xs text-[var(--muted)]">
                    {item.account_identifier}
                  </div>
                </Cell>
                <Cell>
                  <StatusBadge value={item.status} />
                </Cell>
                <Cell mono>{item.product_variant_id}</Cell>
                <Cell mono>{item.order_id || item.cart_id || "-"}</Cell>
                <Cell>{formatDate(item.delivered_at)}</Cell>
              </tr>
            ))}
          </AdminTable>
        </Panel>
      </div>
    </main>
  )
}

function variantLabel(variant: CatalogVariant) {
  const product =
    variant.product_title || variant.product_handle || variant.product_id || "-"
  const name = variant.title || variant.sku || variant.id
  const stock =
    typeof variant.available_count === "number"
      ? `可用 ${variant.available_count}`
      : "库存未知"
  const unsupported = variant.credential_inventory_supported
    ? ""
    : " / 非凭证库存"

  return `${product} / ${name} / ${variant.template_title} / ${stock}${unsupported}`
}

function variantSummary(variant: CatalogVariant) {
  const stock =
    typeof variant.available_count === "number"
      ? `可用 ${variant.available_count} / 预留 ${variant.reserved_count ?? 0} / 已售 ${variant.sold_count ?? 0} / 总 ${variant.total_count ?? 0}`
      : "库存未知"

  return `库存处理器 ${variant.inventory_handler_code} · 交付处理器 ${variant.delivery_handler_code || "-"} · ${stock}`
}

function sumField(batches: Batch[] | undefined, key: keyof Batch) {
  if (!batches) {
    return 0
  }

  return batches.reduce((total, batch) => {
    const value = batch[key]
    return total + (typeof value === "number" ? value : 0)
  }, 0)
}

function parseCredentialLines(value: string): ImportItem[] {
  const text = value.trim()

  if (!text) {
    throw new Error("请填写要导入的凭证。")
  }

  if (text.startsWith("[")) {
    const parsed = JSON.parse(text) as ImportItem[]

    if (!Array.isArray(parsed)) {
      throw new Error("JSON 导入必须是数组。")
    }

    return parsed
  }

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      if (line.startsWith("{")) {
        const parsed = JSON.parse(line) as ImportItem

        if (typeof parsed.credential === "undefined") {
          throw new Error(`第 ${index + 1} 行缺少 credential 字段。`)
        }

        return parsed
      }

      const delimiter = ["----", "\t", ",", "|", ":"].find((candidate) =>
        line.includes(candidate),
      )

      if (!delimiter) {
        return {
          display_label: `卡密 ${index + 1}`,
          credential: line,
        }
      }

      const delimiterIndex = line.indexOf(delimiter)
      const username = line.slice(0, delimiterIndex).trim()
      const password = line.slice(delimiterIndex + delimiter.length).trim()

      if (!username || !password) {
        throw new Error(`第 ${index + 1} 行的账号或密码为空。`)
      }

      return {
        display_label: `账号 ${index + 1}`,
        credential: { username, password },
      }
    })
}

function AdminTable({
  headers,
  empty,
  children,
}: {
  headers: string[]
  empty: boolean
  children: ReactNode
}) {
  return (
    <>
      <TableShell>
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
              {headers.map((header) => (
                <th
                  key={header}
                  className="border-b border-[var(--border)] py-2 pr-4"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </TableShell>
      {empty ? <Message tone="info">暂无数据</Message> : null}
    </>
  )
}

function Cell({ children, mono }: { children: ReactNode; mono?: boolean }) {
  return (
    <td
      className={
        mono
          ? "border-b border-[var(--border)] py-3 pr-4 font-mono text-xs"
          : "border-b border-[var(--border)] py-3 pr-4"
      }
    >
      {children}
    </td>
  )
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败。"
}
