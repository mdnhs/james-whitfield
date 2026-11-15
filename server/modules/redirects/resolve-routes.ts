import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import * as z from "zod"

import { resolvePath } from "@/lib/seo/route-resolution"
import { validationHook } from "@/server/api/errors"
import type { AppEnv } from "@/server/api/types"
import { getDb } from "@/server/db/client"
import { getSetting } from "@/server/modules/content/queries"
import { defer } from "@/server/lib/defer"

import { getRouteTable } from "./queries"
import { recordHit } from "./service"

// Public and read-only: answers only what visiting the URL would reveal.
// proxy.ts calls it over loopback (Ruling R2).
export const resolveRoutes = new Hono<AppEnv>()
  // Which address the site prefers (lib/seo/canonical-host). proxy.ts caches
  // this briefly.
  .get("/host", async (c) => {
    const { preferredHost } = await getSetting("seo")
    c.header("Cache-Control", "no-store")
    return c.json({ preferred: preferredHost })
  })
  .get(
    "/",
    zValidator(
      "query",
      z.object({ path: z.string().startsWith("/").max(512) }),
      validationHook
    ),
    async (c) => {
      const { path } = c.req.valid("query")
      const result = resolvePath(await getRouteTable(), path)
      if (result.kind === "redirect")
        defer(() => recordHit(getDb(), path), "redirect hit")
      c.header("Cache-Control", "no-store")
      return c.json(result)
    }
  )
