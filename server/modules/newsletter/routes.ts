import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import * as z from "zod"

import { SubscriberExportQuery, SubscriberListQuery } from "@/lib/leads/schema"
import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import * as service from "./service"

const IdParam = z.object({ id: z.uuid() })
const today = () => new Date().toISOString().slice(0, 10)

export const newsletterRoutes = new Hono<AppEnv>()
  .get(
    "/",
    can({ newsletter: ["read"] }),
    zValidator("query", SubscriberListQuery, validationHook),
    async (c) => {
      c.header("Cache-Control", "no-store")
      return c.json(await service.listSubscribers(c.req.valid("query")))
    }
  )
  .get(
    "/export.csv",
    can({ newsletter: ["export"] }),
    zValidator("query", SubscriberExportQuery, validationHook),
    async (c) => {
      const csv = await service.exportSubscribers(
        c.get("actor")!,
        c.req.valid("query").status
      )
      return c.body(csv, 200, {
        "Cache-Control": "no-store",
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="subscribers-${today()}.csv"`,
      })
    }
  )
  .delete(
    "/:id",
    can({ newsletter: ["delete"] }),
    zValidator("param", IdParam, validationHook),
    async (c) =>
      c.json(
        await service.deleteSubscriber(c.get("actor")!, c.req.valid("param").id)
      )
  )

export type NewsletterRoutes = typeof newsletterRoutes
