import {
  defineMiddlewares,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z, ZodError, type ZodTypeAny } from "zod"

const limitSchema = z.coerce.number().int().min(1).max(200).optional()

const paymentMethodsQuerySchema = z.object({
  amount: z.coerce.number().nonnegative().optional(),
  currency: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{3}$/)
    .optional(),
})

const paymentAttemptsQuerySchema = z.object({
  status: z.string().trim().min(1).optional(),
  cart_id: z.string().trim().min(1).optional(),
  provider_code: z.string().trim().min(1).optional(),
  limit: limitSchema,
})

const simpleLimitQuerySchema = z.object({
  limit: limitSchema,
})

const productAvailabilityQuerySchema = z.object({
  variant_ids: z.union([z.string(), z.array(z.string())]).optional(),
})

const recoverOrderBodySchema = z.object({
  email: z.string().trim().email(),
  order_id: z.string().trim().min(1),
})

const verifyRecoverBodySchema = z.object({
  order_id: z.string().trim().min(1),
  code: z.string().trim().regex(/^\d{6}$/),
})

const claimOrderAccessBodySchema = z.object({
  claim_token: z.string().trim().min(16),
})

const createCartPaymentBodySchema = z.object({
  payment_method: z.string().trim().optional(),
})

const paymentWebhookSchema = z.object({
  provider_order_id: z.string().trim().min(1),
  status: z.enum(["paid", "failed", "expired"]),
})

const manualPaymentWebhookSchema = z.object({
  provider_order_id: z.string().trim().min(1),
  status: z.literal("paid"),
})

function validateAndTransformSimpleQuery(schema: ZodTypeAny) {
  return (req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) => {
    try {
      req.validatedQuery = schema.parse(req.query) as Record<string, unknown>
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          new MedusaError(
            MedusaError.Types.INVALID_DATA,
            error.issues.map((issue) => issue.message).join(", ")
          )
        )
        return
      }

      next(error)
    }
  }
}

export default defineMiddlewares({
  routes: [
    {
      matcher: "/hooks/payment/:provider_code",
      methods: ["POST"],
      bodyParser: {
        preserveRawBody: true,
      },
      middlewares: [validateAndTransformBody(paymentWebhookSchema.passthrough())],
    },
    {
      matcher: "/hooks/payment/manual",
      methods: ["POST"],
      bodyParser: {
        preserveRawBody: true,
      },
      middlewares: [validateAndTransformBody(manualPaymentWebhookSchema.passthrough())],
    },
    {
      matcher: "/store/payment-methods",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(paymentMethodsQuerySchema)],
    },
    {
      matcher: "/admin/payment-attempts",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(paymentAttemptsQuerySchema)],
    },
    {
      matcher: "/admin/after-sales",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/admin/audit-logs",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/admin/digital-delivery/pending",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/admin/digital-delivery/deliveries",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/admin/credential-inventory/items",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/store/product-availability",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(productAvailabilityQuerySchema)],
    },
    {
      matcher: "/store/orders/recover",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(recoverOrderBodySchema)],
    },
    {
      matcher: "/store/orders/recover/verify",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(verifyRecoverBodySchema)],
    },
    {
      matcher: "/store/payment-attempts/:id/claim-order-access",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(claimOrderAccessBodySchema)],
    },
    {
      matcher: "/store/carts/:cart_id/payments",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(createCartPaymentBodySchema)],
    },
  ],
})
