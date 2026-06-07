import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Heading, Input, Table } from "@medusajs/ui"
import { FormEvent, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { AdminSection } from "../../components/admin-section"
import { LocalizedStatusSelect } from "../../components/localized-status-select"
import { MessageBox } from "../../components/message-box"
import { adminApi, formatDate } from "../../lib/admin-api"
import { translatedStatus } from "../../lib/i18n"

type MarketingCampaign = {
  id: string
  code: string
  name: string
  status: string
  starts_at?: string | null
  ends_at?: string | null
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

const CAMPAIGN_STATUS_OPTIONS = [
  "draft",
  "active",
  "paused",
  "archived",
] as const

const COUPON_STATUS_OPTIONS = ["active", "disabled", "expired"] as const

const MarketingPage = () => {
  const { t } = useTranslation()
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([])
  const [coupons, setCoupons] = useState<MarketingCoupon[]>([])
  const [referralLinks, setReferralLinks] = useState<MarketingReferralLink[]>([])
  const [touchpoints, setTouchpoints] = useState<MarketingTouchpoint[]>([])

  const [campaignCode, setCampaignCode] = useState("")
  const [campaignName, setCampaignName] = useState("")
  const [campaignStatus, setCampaignStatus] = useState("draft")

  const [couponCode, setCouponCode] = useState("")
  const [couponStatus, setCouponStatus] = useState("active")
  const [couponMaxRedemptions, setCouponMaxRedemptions] = useState("")

  const [referralCode, setReferralCode] = useState("")
  const [referrerEmail, setReferrerEmail] = useState("")
  const [referralMaxUses, setReferralMaxUses] = useState("")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    void refresh()
  }, [])

  async function refresh() {
    const [campaignData, couponData, referralData, touchpointData] =
      await Promise.all([
        adminApi<{ campaigns: MarketingCampaign[] }>(
          "/admin/marketing/campaigns?limit=50"
        ),
        adminApi<{ coupons: MarketingCoupon[] }>(
          "/admin/marketing/coupons?limit=50"
        ),
        adminApi<{ referral_links: MarketingReferralLink[] }>(
          "/admin/marketing/referral-links?limit=50"
        ),
        adminApi<{ touchpoints: MarketingTouchpoint[] }>(
          "/admin/marketing/touchpoints?limit=100"
        ),
      ])

    setCampaigns(campaignData.campaigns || [])
    setCoupons(couponData.coupons || [])
    setReferralLinks(referralData.referral_links || [])
    setTouchpoints(touchpointData.touchpoints || [])
  }

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    try {
      await adminApi("/admin/marketing/campaigns", {
        method: "POST",
        body: {
          code: campaignCode,
          name: campaignName,
          status: campaignStatus,
        },
      })
      setCampaignCode("")
      setCampaignName("")
      setCampaignStatus("draft")
      setMessage(t("marketing.campaignCreated"))
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("marketing.failedCampaign"))
    } finally {
      setLoading(false)
    }
  }

  async function createCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    try {
      await adminApi("/admin/marketing/coupons", {
        method: "POST",
        body: {
          code: couponCode,
          status: couponStatus,
          max_redemptions: couponMaxRedemptions
            ? Number(couponMaxRedemptions)
            : null,
        },
      })
      setCouponCode("")
      setCouponStatus("active")
      setCouponMaxRedemptions("")
      setMessage(t("marketing.couponCreated"))
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("marketing.failedCoupon"))
    } finally {
      setLoading(false)
    }
  }

  async function createReferralLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    try {
      await adminApi("/admin/marketing/referral-links", {
        method: "POST",
        body: {
          code: referralCode,
          referrer_email: referrerEmail || null,
          max_uses: referralMaxUses ? Number(referralMaxUses) : null,
          status: "active",
        },
      })
      setReferralCode("")
      setReferrerEmail("")
      setReferralMaxUses("")
      setMessage(t("marketing.referralCreated"))
      await refresh()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("marketing.failedReferral")
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-4">
      <AdminSection
        title={t("marketing.createCampaign")}
        description={t("marketing.createCampaignDescription")}
      >
        <form onSubmit={createCampaign} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Input
              value={campaignCode}
              onChange={(event) => setCampaignCode(event.target.value)}
              placeholder="CAMPAIGN_2026"
            />
            <Input
              value={campaignName}
              onChange={(event) => setCampaignName(event.target.value)}
              placeholder={t("marketing.campaignName")}
            />
            <LocalizedStatusSelect
              value={campaignStatus}
              onValueChange={setCampaignStatus}
              options={CAMPAIGN_STATUS_OPTIONS}
            />
          </div>
          <Button type="submit" disabled={loading}>
            {t("marketing.createCampaign")}
          </Button>
        </form>
      </AdminSection>

      <AdminSection title={t("marketing.createCoupon")}>
        <form onSubmit={createCoupon} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Input
              value={couponCode}
              onChange={(event) => setCouponCode(event.target.value)}
              placeholder="SAVE10"
            />
            <LocalizedStatusSelect
              value={couponStatus}
              onValueChange={setCouponStatus}
              options={COUPON_STATUS_OPTIONS}
            />
            <Input
              value={couponMaxRedemptions}
              onChange={(event) => setCouponMaxRedemptions(event.target.value)}
              placeholder={t("marketing.maxRedemptions")}
            />
          </div>
          <Button type="submit" disabled={loading}>
            {t("marketing.createCoupon")}
          </Button>
        </form>
      </AdminSection>

      <AdminSection title={t("marketing.createReferral")}>
        <form onSubmit={createReferralLink} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Input
              value={referralCode}
              onChange={(event) => setReferralCode(event.target.value)}
              placeholder="CREATOR_A"
            />
            <Input
              value={referrerEmail}
              onChange={(event) => setReferrerEmail(event.target.value)}
              placeholder="creator@example.com"
            />
            <Input
              value={referralMaxUses}
              onChange={(event) => setReferralMaxUses(event.target.value)}
              placeholder={t("marketing.maxUses")}
            />
          </div>
          <Button type="submit" disabled={loading}>
            {t("marketing.createReferral")}
          </Button>
        </form>
      </AdminSection>

      <AdminSection title={t("marketing.campaigns")}>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{t("common.fields.code")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.name")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.status")}</Table.HeaderCell>
              <Table.HeaderCell>{t("marketing.start")}</Table.HeaderCell>
              <Table.HeaderCell>{t("marketing.end")}</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {campaigns.map((campaign) => (
              <Table.Row key={campaign.id}>
                <Table.Cell className="font-mono">{campaign.code}</Table.Cell>
                <Table.Cell>{campaign.name}</Table.Cell>
                <Table.Cell>
                  <Badge>{translatedStatus(t, campaign.status)}</Badge>
                </Table.Cell>
                <Table.Cell>{formatDate(campaign.starts_at)}</Table.Cell>
                <Table.Cell>{formatDate(campaign.ends_at)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </AdminSection>

      <AdminSection title={t("marketing.coupons")}>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{t("common.fields.code")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.status")}</Table.HeaderCell>
              <Table.HeaderCell>{t("marketing.redeemed")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.max")}</Table.HeaderCell>
              <Table.HeaderCell>{t("marketing.expires")}</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {coupons.map((coupon) => (
              <Table.Row key={coupon.id}>
                <Table.Cell className="font-mono">{coupon.code}</Table.Cell>
                <Table.Cell>
                  <Badge>{translatedStatus(t, coupon.status)}</Badge>
                </Table.Cell>
                <Table.Cell>{coupon.redeemed_count}</Table.Cell>
                <Table.Cell>{coupon.max_redemptions ?? "-"}</Table.Cell>
                <Table.Cell>{formatDate(coupon.expires_at)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </AdminSection>

      <AdminSection title={t("marketing.referralLinks")}>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{t("common.fields.code")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.status")}</Table.HeaderCell>
              <Table.HeaderCell>{t("marketing.referrer")}</Table.HeaderCell>
              <Table.HeaderCell>{t("marketing.used")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.max")}</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {referralLinks.map((link) => (
              <Table.Row key={link.id}>
                <Table.Cell className="font-mono">{link.code}</Table.Cell>
                <Table.Cell>
                  <Badge>{translatedStatus(t, link.status)}</Badge>
                </Table.Cell>
                <Table.Cell>{link.referrer_email || "-"}</Table.Cell>
                <Table.Cell>{link.used_count}</Table.Cell>
                <Table.Cell>{link.max_uses ?? "-"}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </AdminSection>

      <AdminSection title={t("marketing.recentTouchpoints")}>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{t("common.fields.event")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.attempt")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.order")}</Table.HeaderCell>
              <Table.HeaderCell>{t("marketing.coupon")}</Table.HeaderCell>
              <Table.HeaderCell>{t("marketing.referral")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.attribution")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.created")}</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {touchpoints.map((touchpoint) => (
              <Table.Row key={touchpoint.id}>
                <Table.Cell>
                  <Heading level="h3">{touchpoint.event_name}</Heading>
                </Table.Cell>
                <Table.Cell className="font-mono">
                  {touchpoint.payment_attempt_id || "-"}
                </Table.Cell>
                <Table.Cell className="font-mono">{touchpoint.order_id || "-"}</Table.Cell>
                <Table.Cell>{touchpoint.coupon_code || "-"}</Table.Cell>
                <Table.Cell>{touchpoint.referral_code || "-"}</Table.Cell>
                <Table.Cell>
                  {touchpoint.source || "-"} / {touchpoint.medium || "-"} /{" "}
                  {touchpoint.campaign || "-"}
                </Table.Cell>
                <Table.Cell>{formatDate(touchpoint.created_at)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </AdminSection>

      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" onClick={() => void refresh()}>
          {t("common.actions.refresh")}
        </Button>
      </div>

      <MessageBox error={error} success={message} />
    </div>
  )
}

export const config = defineRouteConfig({
  label: "adminRoutes.marketing",
  translationNs: "translation",
  rank: 26,
})

export default MarketingPage
