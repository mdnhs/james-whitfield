import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import * as z from "zod"

import {
  RedirectInput,
  RedirectListQuery,
  RedirectPatch,
} from "@/lib/seo/redirect-rules"
import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import * as service from "./redirects-service"

const id = zValidator("param", z.object({ id: z.uuid() }), validationHook)
const manage = can({ redirect: ["manage"] })

// docs/brief.md §8.3 SEO row. GET /overview joins in Task 8.
export const seoRoutes = new Hono<AppEnv>()
  .get(
    "/redirects",
    can({ redirect: ["read"] }),
    zValidator("query", RedirectListQuery, validationHook),
    async (c) => c.json(await service.listRedirects(c.req.valid("query")))
  )
  .post(
    "/redirects",
    manage,
    zValidator("json", RedirectInput, validationHook),
    async (c) =>
      c.json(
        await service.createManualRedirect(
          c.get("actor")!,
          c.req.valid("json")
        ),
        201
      )
  )
  .patch(
    "/redirects/:id",
    manage,
    id,
    zValidator("json", RedirectPatch, validationHook),
    async (c) =>
      c.json(
        await service.updateRedirect(
          c.get("actor")!,
          c.req.valid("param").id,
          c.req.valid("json")
        )
      )
  )
  .delete("/redirects/:id", manage, id, async (c) =>
    c.json(
      await service.deleteRedirect(c.get("actor")!, c.req.valid("param").id)
    )
  )

export type SeoRoutes = typeof seoRoutes
