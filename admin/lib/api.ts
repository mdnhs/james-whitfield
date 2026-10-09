import {
  DetailedError,
  hc,
  parseResponse as parseHonoResponse,
  type ClientResponse,
} from "hono/client"

import type { ErrorCode } from "@/server/api/errors"
import type { AuditRoutes } from "@/server/modules/audit/routes"

import { ApiError } from "./api-error"

// One client per sub-app keeps TypeScript fast (docs/brief.md §8.1). Same
// origin, so the session cookie flows without configuration.
export const auditApi = hc<AuditRoutes>("/api/v1/admin/audit")

type Envelope = {
  error?: {
    code?: unknown
    message?: unknown
    requestId?: unknown
    fieldErrors?: unknown
  }
}

const UNREACHABLE =
  "Couldn't reach the server. Check your connection and try again."

// Runtime list of the server's codes; `satisfies` keeps it in step with the
// type-only ErrorCode union.
const KNOWN_CODES = {
  BAD_REQUEST: true,
  VALIDATION_FAILED: true,
  UNAUTHENTICATED: true,
  FORBIDDEN: true,
  TWO_FACTOR_REQUIRED: true,
  NOT_FOUND: true,
  CONFLICT: true,
  PAYLOAD_TOO_LARGE: true,
  RATE_LIMITED: true,
  UNAVAILABLE: true,
  INTERNAL: true,
} satisfies Record<ErrorCode, true>

function isKnownCode(code: unknown): code is ErrorCode {
  return typeof code === "string" && Object.hasOwn(KNOWN_CODES, code)
}

// For answers that are not our envelope (proxy pages, HTML, malformed JSON).
function codeForStatus(status: number): ErrorCode {
  if (status === 401) return "UNAUTHENTICATED"
  if (status === 403) return "FORBIDDEN"
  if (status === 404) return "NOT_FOUND"
  if (status === 409) return "CONFLICT"
  if (status === 413) return "PAYLOAD_TOO_LARGE"
  if (status === 429) return "RATE_LIMITED"
  if (status === 503) return "UNAVAILABLE"
  if (status >= 500) return "INTERNAL"
  return "BAD_REQUEST"
}

const FALLBACK_MESSAGE: Partial<Record<ErrorCode, string>> = {
  UNAUTHENTICATED: "Your session has ended. Sign in again.",
  FORBIDDEN: "You don't have permission to do that",
  NOT_FOUND: "We couldn't find that",
  RATE_LIMITED: "Too many requests. Wait a moment and try again.",
  UNAVAILABLE: "The service is unavailable right now. Try again shortly.",
  INTERNAL: "Something went wrong on our side. Try again.",
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "AbortError"
  )
}

function fromStatus(status: number, envelope?: Envelope["error"]) {
  const known = isKnownCode(envelope?.code)
  const code = known ? (envelope!.code as ErrorCode) : codeForStatus(status)
  const message =
    known && typeof envelope?.message === "string"
      ? envelope.message
      : (FALLBACK_MESSAGE[code] ?? "Something went wrong")
  const fieldErrors =
    known &&
    typeof envelope?.fieldErrors === "object" &&
    envelope.fieldErrors !== null
      ? (envelope.fieldErrors as Record<string, string[]>)
      : {}
  const requestId =
    known && typeof envelope?.requestId === "string" ? envelope.requestId : null
  return new ApiError(code, message, status, requestId, fieldErrors)
}

// `status` is the HTTP status when an answer arrived (a malformed body throws
// a SyntaxError that carries none).
export function toApiError(error: unknown, status = 0): ApiError {
  if (error instanceof ApiError) return error
  if (error instanceof DetailedError) {
    const detailStatus = Number(error.statusCode ?? status)
    const data = (error.detail as { data?: unknown } | undefined)?.data
    const envelope =
      typeof data === "object" && data !== null
        ? (data as Envelope).error
        : undefined
    return fromStatus(detailStatus, envelope)
  }
  if (status > 0) return fromStatus(status)
  // fetch() rejects with a TypeError only when no answer arrived at all.
  if (error instanceof TypeError) return new ApiError("NETWORK", UNREACHABLE, 0)
  return new ApiError("INTERNAL", FALLBACK_MESSAGE.INTERNAL!, 0)
}

// Hono's typed parser, with failures as ApiError so queries, forms and
// toasts handle one error type. An aborted request is not a failure: the
// AbortError is rethrown untouched (TanStack Query ignores it).
export async function parseResponse<T extends ClientResponse<unknown>>(
  request: T | Promise<T>
) {
  let status = 0
  try {
    const response = await request
    status = response.status
    return await parseHonoResponse(response)
  } catch (error) {
    if (isAbortError(error)) throw error
    throw toApiError(error, status)
  }
}
