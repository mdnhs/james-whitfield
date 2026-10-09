import "server-only"

import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import * as z from "zod"

export type ErrorCode =
  | "BAD_REQUEST" // other 4xx (405, 415, 422...): status carries the detail
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "TWO_FACTOR_REQUIRED" // owner/admin signed in but has not set up 2FA
  | "IMPERSONATION_READ_ONLY" // account self-service during View-as
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED"
  | "UNAVAILABLE"
  | "INTERNAL"

const STATUS: Record<ErrorCode, ContentfulStatusCode> = {
  BAD_REQUEST: 400,
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  TWO_FACTOR_REQUIRED: 403,
  IMPERSONATION_READ_ONLY: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  UNAVAILABLE: 503,
  INTERNAL: 500,
}

// Thrown by middleware and services; rendered by handleError.
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly fieldErrors?: Record<string, string[]>
  ) {
    super(message)
  }

  get status() {
    return STATUS[this.code]
  }
}

export function errorBody(
  code: ErrorCode,
  message: string,
  requestId: string,
  fieldErrors?: Record<string, string[]>
) {
  return {
    error: { code, message, requestId, ...(fieldErrors && { fieldErrors }) },
  }
}

const CODE_FOR_STATUS: Partial<Record<number, ErrorCode>> = {
  400: "VALIDATION_FAILED",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  429: "RATE_LIMITED",
}

export function handleError(error: Error, c: Context) {
  const requestId = String(c.get("requestId") ?? "")
  if (error instanceof ApiError) {
    return c.json(
      errorBody(error.code, error.message, requestId, error.fieldErrors),
      error.status
    )
  }
  if (error instanceof HTTPException && error.status < 500) {
    const code = CODE_FOR_STATUS[error.status] ?? "BAD_REQUEST"
    return c.json(
      errorBody(code, error.message || code, requestId),
      error.status as ContentfulStatusCode
    )
  }
  // 5xx HTTPException messages are internal detail: log, never echo.
  console.error(`[api] ${requestId}`, error)
  return c.json(errorBody("INTERNAL", "Something went wrong", requestId), 500)
}

// @hono/zod-validator hook: field-level messages in the common envelope. The
// validator hands over a Zod 4 core error, not the classic `z.ZodError`.
export function validationHook(result: {
  success: boolean
  error?: z.core.$ZodError
}) {
  if (!result.success && result.error) {
    const { fieldErrors } = z.flattenError(result.error)
    throw new ApiError(
      "VALIDATION_FAILED",
      "Some fields need attention",
      fieldErrors as Record<string, string[]>
    )
  }
}
