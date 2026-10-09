import type { ErrorCode } from "@/server/api/errors"

// The API's error envelope (docs/brief.md §8.2) as the admin sees it, plus
// NETWORK for a request that never got an answer. Type-only import: the
// union stays in step with the server without bundling server code.
export type ApiErrorCode = ErrorCode | "NETWORK"

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status: number,
    readonly requestId: string | null = null,
    readonly fieldErrors: Record<string, string[]> = {}
  ) {
    super(message)
    this.name = "ApiError"
  }
}
