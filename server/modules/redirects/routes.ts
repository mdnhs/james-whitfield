import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import * as z from "zod"

import { PreviewPath } from "@/lib/content/page-path"
import { validationHook } from "@/server/api/errors"
import type { AppEnv } from "@/server/api/types"

import { getRedirectTable } from "./queries"

// Public and read-only: answers only what visiting the URL would reveal.
// Called by proxy.ts over loopback (Ruling R1).
export const redirectsRoutes = new Hono<AppEnv>().get(
  "/",
  zValidator("query", z.object({ path: PreviewPath }), validationHook),
  async (c) => {
    const hit = (await getRedirectTable())[c.req.valid("query").path]
    return hit ? c.json(hit) : c.body(null, 204)
  }
)
