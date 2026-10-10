import "server-only"

import { createMiddleware } from "hono/factory"

import { errorBody } from "@/server/api/errors"
import type { AppEnv } from "@/server/api/types"
import { clientIp } from "@/server/lib/client-ip"
import { hashIp } from "@/server/lib/crypto"
import { hitLimit } from "@/server/lib/rate-limit-db"

// docs/brief.md §8.1 "/v1/public/* → rateLimit". Answers directly so the
// Retry-After header survives (the error handler builds a fresh response).
export const publicLimit = (
  name: string,
  opts: { limit: number; windowMs: number }
) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const ip = clientIp(c.req.raw.headers) ?? "unknown"
    const { allowed, retryAfterSec } = await hitLimit(
      `${name}:ip:${hashIp(ip)}`,
      opts
    )
    if (!allowed) {
      return c.json(
        errorBody(
          "RATE_LIMITED",
          "Too many requests. Try again later.",
          c.get("requestId")
        ),
        429,
        { "Retry-After": String(retryAfterSec) }
      )
    }
    await next()
  })
