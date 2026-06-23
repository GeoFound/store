"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { formatDate, formatValue } from "@/lib/format"
import {
  createSalesChannel as createAdminSalesChannel,
  loadSystemSettings as loadProductAdminSystemSettings,
  updateStoreName,
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

type StoreRecord = {
  id: string
  name: string
  default_region_id?: string | null
  default_sales_channel_id?: string | null
  supported_currencies?: Array<{
    currency_code: string
    is_default?: boolean | null
    is_tax_inclusive?: boolean | null
  }>
  supported_locales?: Array<{ locale_code: string }>
  updated_at?: string | null
}

type AdminUser = {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  created_at?: string | null
}

type Region = {
  id: string
  name: string
  currency_code?: string | null
  countries?: Array<{ iso_2?: string | null; display_name?: string | null }>
  payment_providers?: Array<{ id?: string | null }>
  automatic_taxes?: boolean | null
  is_tax_inclusive?: boolean | null
}

type SalesChannel = {
  id: string
  name: string
  description?: string | null
  is_disabled?: boolean | null
  created_at?: string | null
}

type ApiKey = {
  id: string
  title: string
  type: string
  redacted?: string | null
  revoked_at?: string | null
  created_at?: string | null
}

type FeatureFlag = {
  key?: string
  name?: string
  enabled?: boolean
  value?: unknown
}

type PluginRecord = {
  name?: string
  version?: string
  resolve?: string
  options?: unknown
}

type StoreForm = {
  storeId: string
  name: string
}

type SalesChannelForm = {
  name: string
  description: string
  isDisabled: boolean
}

const EMPTY_STORE_FORM: StoreForm = { storeId: "", name: "" }
const EMPTY_SALES_CHANNEL_FORM: SalesChannelForm = {
  name: "",
  description: "",
  isDisabled: false,
}

async function loadSystemSettings() {
  return loadProductAdminSystemSettings() as Promise<{
    stores: StoreRecord[]
    users: AdminUser[]
    regions: Region[]
    salesChannels: SalesChannel[]
    apiKeys: ApiKey[]
    featureFlags: FeatureFlag[]
    plugins: PluginRecord[]
  }>
}

export function SystemSettingsView() {
  const queryClient = useQueryClient()
  const [storeForm, setStoreForm] = useState<StoreForm>(EMPTY_STORE_FORM)
  const [salesChannelForm, setSalesChannelForm] = useState<SalesChannelForm>(
    EMPTY_SALES_CHANNEL_FORM,
  )
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const settingsQuery = useQuery({
    queryKey: ["system-settings"],
    queryFn: loadSystemSettings,
  })
  const data = settingsQuery.data

  const selectedStore = useMemo(
    () =>
      data?.stores.find((store) => store.id === storeForm.storeId) ||
      data?.stores[0] ||
      null,
    [data?.stores, storeForm.storeId],
  )

  const updateStore = useMutation({
    mutationFn: () => {
      const storeId = storeForm.storeId || selectedStore?.id

      return updateStoreName({ storeId: storeId ?? "", name: storeForm.name })
    },
    onSuccess: async () => {
      setMessage("store 已更新。")
      setError("")
      setStoreForm(EMPTY_STORE_FORM)
      await queryClient.invalidateQueries({ queryKey: ["system-settings"] })
    },
    onError: (err) => setError(normalizeError(err)),
  })

  const createSalesChannel = useMutation({
    mutationFn: () => {
      return createAdminSalesChannel(salesChannelForm)
    },
    onSuccess: async () => {
      setMessage("销售渠道已创建。")
      setError("")
      setSalesChannelForm(EMPTY_SALES_CHANNEL_FORM)
      await queryClient.invalidateQueries({ queryKey: ["system-settings"] })
    },
    onError: (err) => setError(normalizeError(err)),
  })

  function chooseStore(storeId: string) {
    const store = data?.stores.find((item) => item.id === storeId)
    setStoreForm({
      storeId,
      name: store?.name || "",
    })
  }

  return (
    <main className="px-5 py-5">
      <PageHeader
        title="系统设置"
        description="独立后台系统控制面，覆盖 store、管理员用户、区域、销售渠道、API key、feature flag 和插件可见性。"
        action={
          <SecondaryButton
            type="button"
            onClick={() => void settingsQuery.refetch()}
          >
            刷新
          </SecondaryButton>
        }
      />

      <section className="mb-4 grid gap-3 md:grid-cols-4">
        <MetricCard label="Stores" value={data?.stores.length || 0} detail="store records" />
        <MetricCard label="Users" value={data?.users.length || 0} detail="admin users" />
        <MetricCard label="Regions" value={data?.regions.length || 0} detail="tax/payment" />
        <MetricCard label="API keys" value={data?.apiKeys.length || 0} detail="redacted only" />
      </section>

      <div className="mb-4 grid gap-2">
        {error ? <Message tone="error">{error}</Message> : null}
        {message ? <Message tone="info">{message}</Message> : null}
        {settingsQuery.error ? (
          <Message tone="error">{settingsQuery.error.message}</Message>
        ) : null}
        {settingsQuery.isLoading ? <Message tone="info">加载中</Message> : null}
      </div>

      <div className="grid gap-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Store 设置">
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                setMessage("")
                void updateStore.mutate()
              }}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="store">
                  <SelectInput
                    value={storeForm.storeId || selectedStore?.id || ""}
                    onChange={(event) => chooseStore(event.target.value)}
                  >
                    {data?.stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="名称">
                  <TextInput
                    value={storeForm.name}
                    onChange={(event) =>
                      setStoreForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder={selectedStore?.name || ""}
                  />
                </Field>
              </div>
              {selectedStore ? (
                <Message tone="info">
                  默认区域 {selectedStore.default_region_id || "-"} · 默认渠道{" "}
                  {selectedStore.default_sales_channel_id || "-"} · 币种{" "}
                  {(selectedStore.supported_currencies || [])
                    .map((currency) => currency.currency_code)
                    .join(", ") || "-"}
                </Message>
              ) : null}
              <div>
                <PrimaryButton type="submit" disabled={updateStore.isPending}>
                  {updateStore.isPending ? "保存中" : "保存 store"}
                </PrimaryButton>
              </div>
            </form>
          </Panel>

          <Panel title="新建销售渠道">
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                setMessage("")
                void createSalesChannel.mutate()
              }}
            >
              <Field label="名称">
                <TextInput
                  value={salesChannelForm.name}
                  onChange={(event) =>
                    setSalesChannelForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="描述">
                <TextAreaInput
                  value={salesChannelForm.description}
                  onChange={(event) =>
                    setSalesChannelForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <input
                  type="checkbox"
                  checked={salesChannelForm.isDisabled}
                  onChange={(event) =>
                    setSalesChannelForm((current) => ({
                      ...current,
                      isDisabled: event.target.checked,
                    }))
                  }
                />
                创建为禁用
              </label>
              <div>
                <PrimaryButton
                  type="submit"
                  disabled={createSalesChannel.isPending}
                >
                  {createSalesChannel.isPending ? "创建中" : "创建销售渠道"}
                </PrimaryButton>
              </div>
            </form>
          </Panel>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="管理员用户">
            <AdminTable
              headers={["用户", "ID", "创建"]}
              empty={!settingsQuery.isLoading && (data?.users.length || 0) === 0}
            >
              {data?.users.map((user) => (
                <tr key={user.id} className="align-top">
                  <Cell>
                    <div className="font-medium">{user.email}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {[user.first_name, user.last_name].filter(Boolean).join(" ") ||
                        "-"}
                    </div>
                  </Cell>
                  <Cell mono>{user.id}</Cell>
                  <Cell>{formatDate(user.created_at)}</Cell>
                </tr>
              ))}
            </AdminTable>
          </Panel>

          <Panel title="区域">
            <AdminTable
              headers={["区域", "币种", "国家", "税"]}
              empty={!settingsQuery.isLoading && (data?.regions.length || 0) === 0}
            >
              {data?.regions.map((region) => (
                <tr key={region.id} className="align-top">
                  <Cell>
                    <div className="font-medium">{region.name}</div>
                    <div className="font-mono text-xs text-[var(--muted)]">
                      {region.id}
                    </div>
                  </Cell>
                  <Cell mono>{region.currency_code || "-"}</Cell>
                  <Cell>
                    {(region.countries || [])
                      .map((country) => country.iso_2 || country.display_name)
                      .filter(Boolean)
                      .join(", ") || "-"}
                  </Cell>
                  <Cell>
                    {region.automatic_taxes ? "自动" : "手动"} ·{" "}
                    {region.is_tax_inclusive ? "含税" : "不含税"}
                  </Cell>
                </tr>
              ))}
            </AdminTable>
          </Panel>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="销售渠道">
            <AdminTable
              headers={["渠道", "状态", "创建"]}
              empty={
                !settingsQuery.isLoading &&
                (data?.salesChannels.length || 0) === 0
              }
            >
              {data?.salesChannels.map((channel) => (
                <tr key={channel.id} className="align-top">
                  <Cell>
                    <div className="font-medium">{channel.name}</div>
                    <div className="font-mono text-xs text-[var(--muted)]">
                      {channel.id}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {channel.description || "-"}
                    </div>
                  </Cell>
                  <Cell>
                    <StatusBadge
                      value={channel.is_disabled ? "disabled" : "active"}
                    />
                  </Cell>
                  <Cell>{formatDate(channel.created_at)}</Cell>
                </tr>
              ))}
            </AdminTable>
          </Panel>

          <Panel title="API keys">
            <AdminTable
              headers={["Key", "类型", "状态", "创建"]}
              empty={!settingsQuery.isLoading && (data?.apiKeys.length || 0) === 0}
            >
              {data?.apiKeys.map((apiKey) => (
                <tr key={apiKey.id} className="align-top">
                  <Cell>
                    <div className="font-medium">{apiKey.title}</div>
                    <div className="font-mono text-xs text-[var(--muted)]">
                      {apiKey.redacted || apiKey.id}
                    </div>
                  </Cell>
                  <Cell mono>{apiKey.type}</Cell>
                  <Cell>
                    <StatusBadge value={apiKey.revoked_at ? "revoked" : "active"} />
                  </Cell>
                  <Cell>{formatDate(apiKey.created_at)}</Cell>
                </tr>
              ))}
            </AdminTable>
          </Panel>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Feature flags">
            <AdminTable
              headers={["Flag", "状态", "值"]}
              empty={
                !settingsQuery.isLoading &&
                (data?.featureFlags.length || 0) === 0
              }
            >
              {data?.featureFlags.map((flag, index) => (
                <tr key={flag.key || flag.name || index} className="align-top">
                  <Cell>{flag.name || flag.key || `flag-${index + 1}`}</Cell>
                  <Cell>
                    <StatusBadge value={flag.enabled ? "active" : "disabled"} />
                  </Cell>
                  <Cell mono>{formatValue(flag.value)}</Cell>
                </tr>
              ))}
            </AdminTable>
          </Panel>

          <Panel title="插件">
            <AdminTable
              headers={["插件", "版本", "解析"]}
              empty={!settingsQuery.isLoading && (data?.plugins.length || 0) === 0}
            >
              {data?.plugins.map((plugin, index) => (
                <tr key={`${plugin.name || "plugin"}-${index}`} className="align-top">
                  <Cell>{plugin.name || `plugin-${index + 1}`}</Cell>
                  <Cell mono>{plugin.version || "-"}</Cell>
                  <Cell mono>{plugin.resolve || "-"}</Cell>
                </tr>
              ))}
            </AdminTable>
          </Panel>
        </div>
      </div>
    </main>
  )
}
