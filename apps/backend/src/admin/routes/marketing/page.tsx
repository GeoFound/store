import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Heading, Input, Table } from "@medusajs/ui"
import { FormEvent, useEffect, useState } from "react"
import { AdminSection } from "../../components/admin-section"
import { MessageBox } from "../../components/message-box"
import { adminApi, formatDate } from "../../lib/admin-api"

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

const MarketingPage = () => {
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
      setMessage("Campaign created.")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create campaign")
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
      setMessage("Coupon created.")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create coupon")
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
      setMessage("Referral link created.")
      await refresh()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create referral link"
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-4">
      <AdminSection
        title="Create Campaign"
        description="Create campaign windows that can be targeted by coupon and referral strategies."
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
              placeholder="Campaign name"
            />
            <Input
              value={campaignStatus}
              onChange={(event) => setCampaignStatus(event.target.value)}
              placeholder="draft|active|paused|archived"
            />
          </div>
          <Button type="submit" disabled={loading}>
            Create campaign
          </Button>
        </form>
      </AdminSection>

      <AdminSection title="Create Coupon">
        <form onSubmit={createCoupon} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Input
              value={couponCode}
              onChange={(event) => setCouponCode(event.target.value)}
              placeholder="SAVE10"
            />
            <Input
              value={couponStatus}
              onChange={(event) => setCouponStatus(event.target.value)}
              placeholder="active|disabled|expired"
            />
            <Input
              value={couponMaxRedemptions}
              onChange={(event) => setCouponMaxRedemptions(event.target.value)}
              placeholder="Max redemptions"
            />
          </div>
          <Button type="submit" disabled={loading}>
            Create coupon
          </Button>
        </form>
      </AdminSection>

      <AdminSection title="Create Referral Link">
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
              placeholder="Max uses"
            />
          </div>
          <Button type="submit" disabled={loading}>
            Create referral link
          </Button>
        </form>
      </AdminSection>

      <AdminSection title="Campaigns">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Code</Table.HeaderCell>
              <Table.HeaderCell>Name</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Start</Table.HeaderCell>
              <Table.HeaderCell>End</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {campaigns.map((campaign) => (
              <Table.Row key={campaign.id}>
                <Table.Cell className="font-mono">{campaign.code}</Table.Cell>
                <Table.Cell>{campaign.name}</Table.Cell>
                <Table.Cell>
                  <Badge>{campaign.status}</Badge>
                </Table.Cell>
                <Table.Cell>{formatDate(campaign.starts_at)}</Table.Cell>
                <Table.Cell>{formatDate(campaign.ends_at)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </AdminSection>

      <AdminSection title="Coupons">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Code</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Redeemed</Table.HeaderCell>
              <Table.HeaderCell>Max</Table.HeaderCell>
              <Table.HeaderCell>Expires</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {coupons.map((coupon) => (
              <Table.Row key={coupon.id}>
                <Table.Cell className="font-mono">{coupon.code}</Table.Cell>
                <Table.Cell>
                  <Badge>{coupon.status}</Badge>
                </Table.Cell>
                <Table.Cell>{coupon.redeemed_count}</Table.Cell>
                <Table.Cell>{coupon.max_redemptions ?? "-"}</Table.Cell>
                <Table.Cell>{formatDate(coupon.expires_at)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </AdminSection>

      <AdminSection title="Referral Links">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Code</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Referrer</Table.HeaderCell>
              <Table.HeaderCell>Used</Table.HeaderCell>
              <Table.HeaderCell>Max</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {referralLinks.map((link) => (
              <Table.Row key={link.id}>
                <Table.Cell className="font-mono">{link.code}</Table.Cell>
                <Table.Cell>
                  <Badge>{link.status}</Badge>
                </Table.Cell>
                <Table.Cell>{link.referrer_email || "-"}</Table.Cell>
                <Table.Cell>{link.used_count}</Table.Cell>
                <Table.Cell>{link.max_uses ?? "-"}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </AdminSection>

      <AdminSection title="Recent Touchpoints">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Event</Table.HeaderCell>
              <Table.HeaderCell>Attempt</Table.HeaderCell>
              <Table.HeaderCell>Order</Table.HeaderCell>
              <Table.HeaderCell>Coupon</Table.HeaderCell>
              <Table.HeaderCell>Referral</Table.HeaderCell>
              <Table.HeaderCell>Attribution</Table.HeaderCell>
              <Table.HeaderCell>Created</Table.HeaderCell>
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
          Refresh
        </Button>
      </div>

      <MessageBox error={error} success={message} />
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Marketing",
  rank: 26,
})

export default MarketingPage
