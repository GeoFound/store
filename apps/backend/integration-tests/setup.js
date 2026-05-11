process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret"
process.env.COOKIE_SECRET = process.env.COOKIE_SECRET || "test_cookie_secret"
process.env.STORE_CORS = process.env.STORE_CORS || "http://localhost:3000"
process.env.ADMIN_CORS = process.env.ADMIN_CORS || "http://localhost:7001"
process.env.AUTH_CORS = process.env.AUTH_CORS || "http://localhost:7001"
process.env.CREDENTIAL_ENCRYPTION_KEY =
  process.env.CREDENTIAL_ENCRYPTION_KEY ||
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
process.env.DELIVERY_ENCRYPTION_KEY =
  process.env.DELIVERY_ENCRYPTION_KEY ||
  process.env.CREDENTIAL_ENCRYPTION_KEY
