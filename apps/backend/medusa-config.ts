import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: resolveSecuritySecret("JWT_SECRET", "test-jwt-secret"),
      cookieSecret: resolveSecuritySecret("COOKIE_SECRET", "test-cookie-secret"),
    }
  },
  modules: [
    {
      resolve: "@medusajs/medusa/caching",
      options: {
        providers: [
          {
            resolve: "@medusajs/caching-redis",
            id: "caching-redis",
            is_default: true,
            options: {
              redisUrl: process.env.REDIS_URL,
            },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/event-bus-redis",
      options: {
        redisUrl: process.env.REDIS_URL,
      },
    },
    {
      resolve: "@medusajs/medusa/workflow-engine-redis",
      options: {
        redis: {
          redisUrl: process.env.REDIS_URL,
        },
      },
    },
    {
      resolve: "@medusajs/medusa/locking",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/locking-redis",
            id: "locking-redis",
            is_default: true,
            options: {
              redisUrl: process.env.REDIS_URL,
            },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/notification-local",
            id: "local",
            is_default: true,
            options: {
              channels: ["email"],
            },
          },
        ],
      },
    },
    {
      resolve: "./src/modules/payment-router",
    },
    {
      resolve: "./src/modules/credential-inventory",
    },
    {
      resolve: "./src/modules/digital-delivery",
    },
    {
      resolve: "./src/modules/support-audit",
    },
    {
      resolve: "./src/modules/guest-order-access",
    },
    {
      resolve: "./src/modules/marketing-engine",
    },
    {
      resolve: "./src/modules/analytics-core",
    },
  ],
})

function resolveSecuritySecret(name: string, testFallback: string) {
  const value = process.env[name]?.trim()

  if (value && value !== "supersecret") {
    return value
  }

  if (process.env.NODE_ENV === "test") {
    return testFallback
  }

  throw new Error(
    `${name} must be configured with a strong secret and cannot use defaults`
  )
}
