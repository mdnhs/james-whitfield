import {
  DetailedError,
  hc,
  parseResponse as parseHonoResponse,
  type ClientResponse,
} from "hono/client"

import type { AuditRoutes } from "@/server/modules/audit/routes"

import { ApiError, type ApiErrorCode } from "./api-error"

// One client per sub-app keeps TypeScript fast (docs/brief.md §8.1). Same
// origin, so the session cookie flows without configuration.
export const auditApi = hc<AuditRoutes>("/api/v1/admin/audit")

type Envelope = {
  error?: {
    code?: string
    message?: string
    requestId?: string
    fieldErrors?: Record<string, string[]>
  }
}

const UNREACHABLE =
  "Couldn't reach the server. Check your connection and try again."

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (error instanceof DetailedError) {
    const status = Number(error.statusCode ?? 0)
    const data = (error.detail as { data?: unknown } | undefined)?.data
    const envelope =
      typeof data === "object" && data !== null
        ? (data as Envelope).error
        : undefined
    const code = (envelope?.code ??
      (status >= 500 ? "INTERNAL" : "BAD_REQUEST")) as ApiErrorCode
    return new ApiError(
      code,
      envelope?.message ?? "Something went wrong",
      status,
      envelope?.requestId ?? null,
      envelope?.fieldErrors ?? {}
    )
  }
  // fetch() only rejects when no answer arrived at all.
  return new ApiError("NETWORK", UNREACHABLE, 0)
}

// Hono's typed parser, with failures as ApiError so queries, forms and
// toasts handle one error type.
export async function parseResponse<T extends ClientResponse<unknown>>(
  request: T | Promise<T>
) {
  try {
    return await parseHonoResponse(request)
  } catch (error) {
    throw toApiError(error)
  }
}
