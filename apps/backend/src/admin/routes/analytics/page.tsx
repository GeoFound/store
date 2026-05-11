import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Heading, Table } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { AdminSection } from "../../components/admin-section"
import { MessageBox } from "../../components/message-box"
import { adminApi, formatDate } from "../../lib/admin-api"

type AnalyticsEvent = {
  id: string
  event_name: string
  source: string
  status: string
  order_id?: string | null
  payment_attempt_id?: string | null
  created_at?: string
}

type AnalyticsDispatch = {
  id: string
  event_id: string
  destination_code: string
  status: string
  attempt_count: number
  next_retry_at?: string | null
  delivered_at?: string | null
  error_message?: string | null
  created_at?: string
}

const AnalyticsPage = () => {
  const [events, setEvents] = useState<AnalyticsEvent[]>([])
  const [dispatches, setDispatches] = useState<AnalyticsDispatch[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    void refresh()
  }, [])

  async function refresh() {
    const [eventData, dispatchData] = await Promise.all([
      adminApi<{ events: AnalyticsEvent[] }>(
        "/admin/analytics/events?limit=100"
      ),
      adminApi<{ dispatches: AnalyticsDispatch[] }>(
        "/admin/analytics/dispatches?limit=100"
      ),
    ])

    setEvents(eventData.events || [])
    setDispatches(dispatchData.dispatches || [])
  }

  async function replayDispatch(dispatchId: string) {
    setLoading(true)
    setError("")
    setMessage("")

    try {
      await adminApi("/admin/analytics/dispatches", {
        method: "POST",
        body: {
          dispatch_id: dispatchId,
        },
      })
      setMessage("Dispatch queued for replay.")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to replay dispatch")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-4">
      <AdminSection
        title="Analytics Events"
        description="Canonical analytics events captured from platform hooks and storefront actions."
      >
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Event</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Source</Table.HeaderCell>
              <Table.HeaderCell>Order</Table.HeaderCell>
              <Table.HeaderCell>Attempt</Table.HeaderCell>
              <Table.HeaderCell>Created</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {events.map((event) => (
              <Table.Row key={event.id}>
                <Table.Cell>
                  <div>
                    <Heading level="h3">{event.event_name}</Heading>
                    <div className="font-mono text-xs text-ui-fg-subtle">{event.id}</div>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Badge>{event.status}</Badge>
                </Table.Cell>
                <Table.Cell>{event.source}</Table.Cell>
                <Table.Cell className="font-mono">{event.order_id || "-"}</Table.Cell>
                <Table.Cell className="font-mono">
                  {event.payment_attempt_id || "-"}
                </Table.Cell>
                <Table.Cell>{formatDate(event.created_at)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </AdminSection>

      <AdminSection
        title="Dispatch Queue"
        description="Per-destination delivery records with retry state and failure diagnostics."
      >
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Destination</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Attempts</Table.HeaderCell>
              <Table.HeaderCell>Next Retry</Table.HeaderCell>
              <Table.HeaderCell>Delivered</Table.HeaderCell>
              <Table.HeaderCell>Error</Table.HeaderCell>
              <Table.HeaderCell></Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {dispatches.map((dispatch) => (
              <Table.Row key={dispatch.id}>
                <Table.Cell>
                  <div>
                    <Heading level="h3">{dispatch.destination_code}</Heading>
                    <div className="font-mono text-xs text-ui-fg-subtle">{dispatch.id}</div>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Badge>{dispatch.status}</Badge>
                </Table.Cell>
                <Table.Cell>{dispatch.attempt_count}</Table.Cell>
                <Table.Cell>{formatDate(dispatch.next_retry_at)}</Table.Cell>
                <Table.Cell>{formatDate(dispatch.delivered_at)}</Table.Cell>
                <Table.Cell className="max-w-[280px] truncate">
                  {dispatch.error_message || "-"}
                </Table.Cell>
                <Table.Cell>
                  <Button
                    variant="secondary"
                    disabled={loading}
                    onClick={() => replayDispatch(dispatch.id)}
                  >
                    Replay
                  </Button>
                </Table.Cell>
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
  label: "Analytics",
  rank: 27,
})

export default AnalyticsPage
