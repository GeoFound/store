import {
  ContainerRegistrationKeys,
  Modules,
  loadEnv,
  defineConfig,
} from '@medusajs/framework/utils'
import "./src/platform-adapters/integrations"
import {
  resolveEncryptionKeyRing,
  resolveSecuritySecret,
} from "./src/utils/runtime-secrets"

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

resolveEncryptionKeyRing("CREDENTIAL_ENCRYPTION_KEY", {
  previousNames: ["CREDENTIAL_ENCRYPTION_KEY_PREVIOUS"],
})
resolveEncryptionKeyRing("DELIVERY_ENCRYPTION_KEY", {
  fallbackName: "CREDENTIAL_ENCRYPTION_KEY",
  previousNames: [
    "DELIVERY_ENCRYPTION_KEY_PREVIOUS",
    "CREDENTIAL_ENCRYPTION_KEY_PREVIOUS",
  ],
})

const googleAuthValues = [
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL,
]
const hasGoogleAuthConfig = googleAuthValues.every(Boolean)

if (googleAuthValues.some(Boolean) && !hasGoogleAuthConfig) {
  throw new Error(
    "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL must be configured together."
  )
}

const customerAuthProviders = ["emailpass", ...(hasGoogleAuthConfig ? ["google"] : [])]
const authProviders = [
  {
    resolve: "@medusajs/medusa/auth-emailpass",
    id: "emailpass",
  },
  ...(hasGoogleAuthConfig
    ? [
        {
          resolve: "@medusajs/medusa/auth-google",
          id: "google",
          options: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackUrl: process.env.GOOGLE_CALLBACK_URL,
          },
        },
      ]
    : []),
]

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      authMethodsPerActor: {
        user: ["emailpass"],
        customer: customerAuthProviders,
      },
      jwtSecret: resolveSecuritySecret("JWT_SECRET", {
        testFallback: "test-jwt-secret",
      }),
      cookieSecret: resolveSecuritySecret("COOKIE_SECRET", {
        testFallback: "test-cookie-secret",
      }),
    }
  },
  modules: [
    {
      resolve: "@medusajs/medusa/auth",
      dependencies: [Modules.CACHE, ContainerRegistrationKeys.LOGGER],
      options: {
        providers: authProviders,
      },
    },
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
      resolve: "./src/modules/supplier-procurement",
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
    {
      resolve: "./src/modules/ai-core",
    },
    {
      resolve: "./src/modules/content-core",
    },
  ],
})
