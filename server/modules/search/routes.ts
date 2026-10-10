import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import * as z from "zod"

import { hasPermission } from "@/lib/auth/permissions"
import { ApiError, validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"
import { takeToken } from "@/server/lib/rate-limit"
import { searchArticleHits } from "@/server/modules/articles/service"

import { searchNavigation } from "./service"

const SearchQuery = z.object({
  q: z.string().trim().max(100).default(""),
})

export const searchRoutes = new Hono<AppEnv>().get(
  "/",
  // API routes gate on the permission itself; pages gate via the nav registry.
  can({ dashboard: ["view"] }),
  zValidator("query", SearchQuery, validationHook),
  async (c) => {
    const actor = c.get("actor")!
    // Per-user in-memory limiter (Ruling R7); closes the Phase 2 limiter carry.
    if (!takeToken(`search:${actor.userId}`, { limit: 30, windowMs: 10_000 })) {
      throw new ApiError(
        "RATE_LIMITED",
        "Too many searches. Wait a moment and try again."
      )
    }
    const { q } = c.req.valid("query")
    const articles = hasPermission(actor.roles, { article: ["read"] })
      ? await searchArticleHits(q)
      : []
    return c.json({ items: [...searchNavigation(actor.roles, q), ...articles] })
  }
)

export type SearchRoutes = typeof searchRoutes
