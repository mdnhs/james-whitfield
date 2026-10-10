import "server-only"

import { createMiddleware } from "hono/factory"

import { errorBody } from "@/server/api/errors"
import type { AppEnv } from "@/server/api/types"
import { hitLimit } from "@/server/lib/rate-limit-db"

// Ruling R16. Per signed-in user, in Postgres (survives restarts and would
// survive a second replica). Placed after can(), so refused calls cost nothing.
export const INVITE_LIMIT = { limit: 20, windowMs: 60 * 60_000 }
export const VIEW_AS_LIMIT = { limit: 10, windowMs: 10 * 60_000 }
export const EXPORT_LIMIT_RATE = { limit: 10, windowMs: 10 * 60_000 }

export const actorLimit = (
  name: string,
  opts: { limit: number; windowMs: number }
) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const actor = c.get("actor")
    if (!actor) return next()
    const { allowed, retryAfterSec } = await hitLimit(
      `${name}:user:${actor.userId}`,
      opts
    )
    if (!allowed) {
      return c.json(
        errorBody(
          "RATE_LIMITED",
          "Too many requests. Wait a moment and try again.",
          c.get("requestId")
        ),
        429,
        { "Retry-After": String(retryAfterSec) }
      )
    }
    await next()
  })
