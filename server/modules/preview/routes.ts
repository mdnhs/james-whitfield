import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { draftMode } from "next/headers"
import * as z from "zod"

import { PreviewPath } from "@/lib/content/page-path"
import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

// Hono runs inside the Next Route Handler, so draftMode() has its request
// store and Next merges the cookie it sets into our redirect.
export const previewRoutes = new Hono<AppEnv>()
  .get(
    "/",
    can({ page: ["read"] }),
    zValidator(
      "query",
      z.object({ path: PreviewPath.default("/") }),
      validationHook
    ),
    async (c) => {
      ;(await draftMode()).enable()
      return c.redirect(c.req.valid("query").path, 307)
    }
  )
  // Leaving must always work, so an odd path falls back to the home page.
  .get(
    "/exit",
    zValidator(
      "query",
      z.object({ path: PreviewPath.catch("/") }),
      validationHook
    ),
    async (c) => {
      ;(await draftMode()).disable()
      return c.redirect(c.req.valid("query").path, 307)
    }
  )

export type PreviewRoutes = typeof previewRoutes
