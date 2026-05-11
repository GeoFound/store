import type { MedusaRequest } from "@medusajs/framework/http"

export function getRequestAuditContext(req: MedusaRequest) {
  const authContext = (
    req as MedusaRequest & {
      auth_context?: {
        actor_id?: string
        actor_type?: string
      }
    }
  ).auth_context

  return {
    actorId: authContext?.actor_id,
    ipAddress: getHeader(req, "x-forwarded-for") || getHeader(req, "x-real-ip"),
    userAgent: getHeader(req, "user-agent"),
  }
}

function getHeader(req: MedusaRequest, name: string) {
  const value = req.headers[name]

  if (Array.isArray(value)) {
    return value[0]
  }

  return typeof value === "string" ? value : undefined
}
