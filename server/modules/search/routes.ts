import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import * as z from "zod"

import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import { searchNavigation } from "./service"

const SearchQuery = z.object({
  q: z.string().trim().max(100).default(""),
})

export const searchRoutes = new Hono<AppEnv>().get(
  "/",
  // API routes gate on the permission itself; pages gate via the nav registry.
  can({ dashboard: ["view"] }),
  zValidator("query", SearchQuery, validationHook),
  (c) => {
    const { q } = c.req.valid("query")
    return c.json({ items: searchNavigation(c.get("actor")!.roles, q) })
  }
)

export type SearchRoutes = typeof searchRoutes
