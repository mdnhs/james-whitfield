import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import * as z from "zod"

import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import { Slug } from "@/lib/content/slug"

import * as servicePages from "./service"

const serviceId = zValidator(
  "param",
  z.object({ serviceId: z.uuid() }),
  validationHook
)

// A service's detail page (/services/<slug>): turned on and off from the
// service, so it takes the collection's permissions.
export const servicePagesRoutes = new Hono<AppEnv>()
  // Every service gets its page automatically; the admin list calls this
  // to make any that are missing.
  .post("/ensure", can({ collection: ["create"] }), async (c) =>
    c.json(await servicePages.ensureServicePages(c.get("actor")!))
  )
  .post("/:serviceId", can({ collection: ["create"] }), serviceId, async (c) =>
    c.json(
      await servicePages.enableServicePage(
        c.get("actor")!,
        c.req.valid("param").serviceId
      ),
      201
    )
  )
  // The slug, edited from the service's page: renames the service.
  .patch(
    "/:serviceId/slug",
    can({ collection: ["update"] }),
    serviceId,
    zValidator("json", z.object({ slug: Slug }), validationHook),
    async (c) =>
      c.json(
        await servicePages.changeServiceSlug(
          c.get("actor")!,
          c.req.valid("param").serviceId,
          c.req.valid("json").slug
        )
      )
  )
  .delete(
    "/:serviceId",
    can({ collection: ["delete"] }),
    serviceId,
    async (c) => {
      await servicePages.disableServicePage(
        c.get("actor")!,
        c.req.valid("param").serviceId
      )
      return c.body(null, 204)
    }
  )

export type ServicePagesRoutes = typeof servicePagesRoutes
