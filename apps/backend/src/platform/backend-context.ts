export type BackendServiceToken = string | symbol

export type BackendRuntimeContext = {
  resolve<T = unknown>(token: BackendServiceToken): T
}

export type BackendLogger = {
  info?: (message: string, meta?: Record<string, unknown>) => void
  warn?: (message: string, meta?: Record<string, unknown>) => void
  error?: (message: string, meta?: Record<string, unknown>) => void
  debug?: (message: string, meta?: Record<string, unknown>) => void
}

export const BACKEND_SERVICE_TOKENS = {
  logger: "logger",
} as const

export function resolveBackendLogger(scope: BackendRuntimeContext) {
  return scope.resolve<BackendLogger>(BACKEND_SERVICE_TOKENS.logger)
}
