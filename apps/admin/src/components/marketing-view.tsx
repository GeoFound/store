"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"
import { formatDate } from "@/lib/format"
import {
  createMarketingCampaign,
  createMarketingCoupon,
  createMarketingReferral,
  loadMarketingWorkspace,
} from "@/lib/product-admin-api"
import { Field, PrimaryButton, SecondaryButton, SelectInput, TextInput } from "./admin-controls"
import { Message, MetricCard, PageHeader, Panel, TableShell } from "./admin-page"
import { StatusBadge } from "./status-badge"

type MarketingCampaign = {
  id: string
  code: string
  name: string
  status: string
  starts_at?: string | null
  ends_at?: string | null
  created_at?: string
}

type MarketingOffer = {
  id: string
  code: string
  name: string
  type: string
  status: string
  priority?: number
  created_at?: string
}

type MarketingCoupon = {
  id: string
  code: string
  status: string
  max_redemptions?: number | null
  max_redemptions_per_email?: number | null
  redeemed_count: number
  expires_at?: string | null
  created_at?: string
}

type MarketingReferralLink = {
  id: string
  code: string
  status: string
  max_uses?: number | null
  used_count: number
  referrer_email?: string | null
  created_at?: string
}

type MarketingTouchpoint = {
  id: string
  event_name: string
  payment_attempt_id?: string | null
  order_id?: string | null
  coupon_code?: string | null
  referral_code?: string | null
  source?: string | null
  medium?: string | null
  campaign?: string | null
  created_at?: string
}

const CAMPAIGN_STATUSES = ["draft", "active", "paused", "archived"]
const COUPON_STATUSES = ["active", "disabled", "expired"]

async function loadMarketing() {
  return loadMarketingWorkspace() as Promise<{
    campaigns: MarketingCampaign[]
    offers: MarketingOffer[]
    coupons: MarketingCoupon[]
    referralLinks: MarketingReferralLink[]
    touchpoints: MarketingTouchpoint[]
  }>
}

export function MarketingView() {
  const queryClient = useQueryClient()
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [campaignForm, setCampaignForm] = useState({
    code: "",
    name: "",
    status: "draft",
  })
  const [couponForm, setCouponForm] = useState({
    code: "",
    status: "active",
    maxRedemptions: "",
  })
  const [referralForm, setReferralForm] = useState({
    code: "",
    referrerEmail: "",
    maxUses: "",
  })
  const marketingQuery = useQuery({
    queryKey: ["marketing"],
    queryFn: loadMarketing,
  })
  const data = marketingQuery.data

  const createCampaign = useMutation({
    mutationFn: async () => {
      if (!campaignForm.code.trim() || !campaignForm.name.trim()) {
        throw new Error("活动代码和名称必填。")
      }

      return createMarketingCampaign(campaignForm)
    },
    onSuccess: async () => {
      setCampaignForm({ code: "", name: "", status: "draft" })
      setMessage("营销活动已创建。")
      setError("")
      await queryClient.invalidateQueries({ queryKey: ["marketing"] })
    },
    onError: (err) => setError(errorMessage(err)),
  })

  const createCoupon = useMutation({
    mutationFn: async () => {
      if (!couponForm.code.trim()) {
        throw new Error("优惠码必填。")
      }

      return createMarketingCoupon(couponForm)
    },
    onSuccess: async () => {
      setCouponForm({ code: "", status: "active", maxRedemptions: "" })
      setMessage("优惠码已创建。")
      setError("")
      await queryClient.invalidateQueries({ queryKey: ["marketing"] })
    },
    onError: (err) => setError(errorMessage(err)),
  })

  const createReferral = useMutation({
    mutationFn: async () => {
      if (!referralForm.code.trim()) {
        throw new Error("推荐码必填。")
      }

      return createMarketingReferral(referralForm)
    },
    onSuccess: async () => {
      setReferralForm({ code: "", referrerEmail: "", maxUses: "" })
      setMessage("推荐链接已创建。")
      setError("")
      await queryClient.invalidateQueries({ queryKey: ["marketing"] })
    },
    onError: (err) => setError(errorMessage(err)),
  })

  const isMutating =
    createCampaign.isPending || createCoupon.isPending || createReferral.isPending

  return (
    <main className="px-5 py-5">
      <PageHeader
        title="营销"
        description="迁移后的营销控制台。创建活动、优惠码和推荐链接会通过同源 BFF 提交到 Medusa /admin/marketing/*。"
        action={
          <SecondaryButton
            type="button"
            onClick={() => void marketingQuery.refetch()}
          >
            刷新
          </SecondaryButton>
        }
      />

      <section className="mb-4 grid gap-3 md:grid-cols-4">
        <MetricCard label="活动" value={data?.campaigns.length || 0} detail="campaigns" />
        <MetricCard label="优惠码" value={data?.coupons.length || 0} detail="coupons" />
        <MetricCard label="推荐链接" value={data?.referralLinks.length || 0} detail="referrals" />
        <MetricCard label="触点" value={data?.touchpoints.length || 0} detail="recent 100" />
      </section>

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <Panel title="创建活动" description="最小字段：code、name、status。">
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              setMessage("")
              void createCampaign.mutate()
            }}
          >
            <Field label="代码">
              <TextInput
                value={campaignForm.code}
                onChange={(event) =>
                  setCampaignForm((current) => ({
                    ...current,
                    code: event.target.value,
                  }))
                }
                placeholder="CAMPAIGN_2026"
              />
            </Field>
            <Field label="名称">
              <TextInput
                value={campaignForm.name}
                onChange={(event) =>
                  setCampaignForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="新活动"
              />
            </Field>
            <Field label="状态">
              <SelectInput
                value={campaignForm.status}
                onChange={(event) =>
                  setCampaignForm((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
              >
                {CAMPAIGN_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <PrimaryButton type="submit" disabled={isMutating}>
              创建活动
            </PrimaryButton>
          </form>
        </Panel>

        <Panel title="创建优惠码" description="可选设置最大兑换次数。">
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              setMessage("")
              void createCoupon.mutate()
            }}
          >
            <Field label="代码">
              <TextInput
                value={couponForm.code}
                onChange={(event) =>
                  setCouponForm((current) => ({
                    ...current,
                    code: event.target.value,
                  }))
                }
                placeholder="SAVE10"
              />
            </Field>
            <Field label="状态">
              <SelectInput
                value={couponForm.status}
                onChange={(event) =>
                  setCouponForm((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
              >
                {COUPON_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="最大兑换次数">
              <TextInput
                inputMode="numeric"
                value={couponForm.maxRedemptions}
                onChange={(event) =>
                  setCouponForm((current) => ({
                    ...current,
                    maxRedemptions: event.target.value,
                  }))
                }
                placeholder="100"
              />
            </Field>
            <PrimaryButton type="submit" disabled={isMutating}>
              创建优惠码
            </PrimaryButton>
          </form>
        </Panel>

        <Panel title="创建推荐链接" description="推荐人邮箱和最大使用次数可选。">
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              setMessage("")
              void createReferral.mutate()
            }}
          >
            <Field label="代码">
              <TextInput
                value={referralForm.code}
                onChange={(event) =>
                  setReferralForm((current) => ({
                    ...current,
                    code: event.target.value,
                  }))
                }
                placeholder="CREATOR_A"
              />
            </Field>
            <Field label="推荐人邮箱">
              <TextInput
                type="email"
                value={referralForm.referrerEmail}
                onChange={(event) =>
                  setReferralForm((current) => ({
                    ...current,
                    referrerEmail: event.target.value,
                  }))
                }
                placeholder="creator@example.com"
              />
            </Field>
            <Field label="最大使用次数">
              <TextInput
                inputMode="numeric"
                value={referralForm.maxUses}
                onChange={(event) =>
                  setReferralForm((current) => ({
                    ...current,
                    maxUses: event.target.value,
                  }))
                }
                placeholder="50"
              />
            </Field>
            <PrimaryButton type="submit" disabled={isMutating}>
              创建推荐链接
            </PrimaryButton>
          </form>
        </Panel>
      </div>

      <div className="mb-4 grid gap-2">
        {error ? <Message tone="error">{error}</Message> : null}
        {message ? <Message tone="info">{message}</Message> : null}
        {marketingQuery.error ? (
          <Message tone="error">{marketingQuery.error.message}</Message>
        ) : null}
        {marketingQuery.isLoading ? <Message tone="info">加载中</Message> : null}
      </div>

      <div className="grid gap-4">
        <Panel title="活动">
          <MarketingTable
            headers={["代码", "名称", "状态", "开始", "结束"]}
            empty={!marketingQuery.isLoading && (data?.campaigns.length || 0) === 0}
          >
            {data?.campaigns.map((campaign) => (
              <tr key={campaign.id} className="align-top">
                <Cell mono>{campaign.code}</Cell>
                <Cell>{campaign.name}</Cell>
                <Cell>
                  <StatusBadge value={campaign.status} />
                </Cell>
                <Cell>{formatDate(campaign.starts_at)}</Cell>
                <Cell>{formatDate(campaign.ends_at)}</Cell>
              </tr>
            ))}
          </MarketingTable>
        </Panel>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="优惠码">
            <MarketingTable
              headers={["代码", "状态", "已兑", "上限", "过期"]}
              empty={!marketingQuery.isLoading && (data?.coupons.length || 0) === 0}
            >
              {data?.coupons.map((coupon) => (
                <tr key={coupon.id} className="align-top">
                  <Cell mono>{coupon.code}</Cell>
                  <Cell>
                    <StatusBadge value={coupon.status} />
                  </Cell>
                  <Cell>{coupon.redeemed_count}</Cell>
                  <Cell>{coupon.max_redemptions ?? "-"}</Cell>
                  <Cell>{formatDate(coupon.expires_at)}</Cell>
                </tr>
              ))}
            </MarketingTable>
          </Panel>

          <Panel title="推荐链接">
            <MarketingTable
              headers={["代码", "状态", "推荐人", "已用", "上限"]}
              empty={
                !marketingQuery.isLoading && (data?.referralLinks.length || 0) === 0
              }
            >
              {data?.referralLinks.map((link) => (
                <tr key={link.id} className="align-top">
                  <Cell mono>{link.code}</Cell>
                  <Cell>
                    <StatusBadge value={link.status} />
                  </Cell>
                  <Cell>{link.referrer_email || "-"}</Cell>
                  <Cell>{link.used_count}</Cell>
                  <Cell>{link.max_uses ?? "-"}</Cell>
                </tr>
              ))}
            </MarketingTable>
          </Panel>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Offers" description="旧后台未开放创建，当前仅展示。">
            <MarketingTable
              headers={["代码", "名称", "类型", "状态"]}
              empty={!marketingQuery.isLoading && (data?.offers.length || 0) === 0}
            >
              {data?.offers.map((offer) => (
                <tr key={offer.id} className="align-top">
                  <Cell mono>{offer.code}</Cell>
                  <Cell>{offer.name}</Cell>
                  <Cell>{offer.type}</Cell>
                  <Cell>
                    <StatusBadge value={offer.status} />
                  </Cell>
                </tr>
              ))}
            </MarketingTable>
          </Panel>

          <Panel title="最近触点">
            <MarketingTable
              headers={["事件", "支付/订单", "优惠", "归因", "创建"]}
              empty={
                !marketingQuery.isLoading && (data?.touchpoints.length || 0) === 0
              }
            >
              {data?.touchpoints.map((touchpoint) => (
                <tr key={touchpoint.id} className="align-top">
                  <Cell>{touchpoint.event_name}</Cell>
                  <Cell mono>
                    {touchpoint.payment_attempt_id ||
                      touchpoint.order_id ||
                      "-"}
                  </Cell>
                  <Cell>
                    {touchpoint.coupon_code || touchpoint.referral_code || "-"}
                  </Cell>
                  <Cell>
                    {touchpoint.source || "-"} / {touchpoint.medium || "-"} /{" "}
                    {touchpoint.campaign || "-"}
                  </Cell>
                  <Cell>{formatDate(touchpoint.created_at)}</Cell>
                </tr>
              ))}
            </MarketingTable>
          </Panel>
        </div>
      </div>
    </main>
  )
}

function MarketingTable({
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

function Cell({
  children,
  mono,
}: {
  children: ReactNode
  mono?: boolean
}) {
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
