import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import * as z from "zod"

import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import * as servicePages from "./service"

const serviceId = zValidator(
  "param",
  z.object({ serviceId: z.uuid() }),
  validationHook
)

// A service's detail page (/services/<slug>): turned on and off from the
// service, so it takes the collection's permissions.
export const servicePagesRoutes = new Hono<AppEnv>()
  .post("/:serviceId", can({ collection: ["create"] }), serviceId, async (c) =>
    c.json(
      await servicePages.enableServicePage(
        c.get("actor")!,
        c.req.valid("param").serviceId
      ),
      201
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
