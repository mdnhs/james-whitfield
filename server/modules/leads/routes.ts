import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import * as z from "zod"

import { LeadListQuery, LeadNote, LeadPatch } from "@/lib/leads/schema"
import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import * as dsar from "./dsar"
import * as service from "./service"

const IdParam = z.object({ id: z.uuid() })
const EmailQuery = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
})
const ExportQuery = LeadListQuery.pick({ folder: true, status: true })
const today = () => new Date().toISOString().slice(0, 10)
// Personal data: never cached by the browser or a proxy.
const NO_STORE = { "Cache-Control": "no-store" }

// Static paths before /:id.
export const leadsRoutes = new Hono<AppEnv>()
  .get(
    "/",
    can({ lead: ["read"] }),
    zValidator("query", LeadListQuery, validationHook),
    async (c) =>
      c.json(await service.listLeads(c.get("actor")!, c.req.valid("query")))
  )
  .get("/stats", can({ lead: ["read"] }), async (c) =>
    c.json(await service.leadStats())
  )
  .get("/assignees", can({ lead: ["update"] }), async (c) =>
    c.json(await service.listAssignees())
  )
  .get(
    "/export.csv",
    can({ lead: ["export"] }),
    zValidator("query", ExportQuery, validationHook),
    async (c) => {
      const csv = await service.exportLeads(
        c.get("actor")!,
        c.req.valid("query")
      )
      return c.body(csv, 200, {
        ...NO_STORE,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="enquiries-${today()}.csv"`,
      })
    }
  )
  .get(
    "/dsar",
    can({ lead: ["export"], newsletter: ["export"] }),
    zValidator("query", EmailQuery, validationHook),
    async (c) => {
      const data = await dsar.exportPerson(
        c.get("actor")!,
        c.req.valid("query").email
      )
      c.header("Cache-Control", NO_STORE["Cache-Control"])
      c.header(
        "Content-Disposition",
        `attachment; filename="privacy-export-${today()}.json"`
      )
      return c.json(data)
    }
  )
  .delete(
    "/dsar",
    can({ lead: ["delete"], newsletter: ["delete"] }),
    zValidator("query", EmailQuery, validationHook),
    async (c) =>
      c.json(
        await dsar.erasePerson(c.get("actor")!, c.req.valid("query").email)
      )
  )
  .get(
    "/:id",
    can({ lead: ["read"] }),
    zValidator("param", IdParam, validationHook),
    async (c) => c.json(await service.getLead(c.req.valid("param").id))
  )
  .patch(
    "/:id",
    can({ lead: ["update"] }),
    zValidator("param", IdParam, validationHook),
    zValidator("json", LeadPatch, validationHook),
    async (c) =>
      c.json(
        await service.updateLead(
          c.get("actor")!,
          c.req.valid("param").id,
          c.req.valid("json")
        )
      )
  )
  .post(
    "/:id/notes",
    can({ lead: ["update"] }),
    zValidator("param", IdParam, validationHook),
    zValidator("json", LeadNote, validationHook),
    async (c) =>
      c.json(
        await service.addNote(
          c.get("actor")!,
          c.req.valid("param").id,
          c.req.valid("json").body
        ),
        201
      )
  )
  .delete(
    "/:id",
    can({ lead: ["delete"] }),
    zValidator("param", IdParam, validationHook),
    async (c) =>
      c.json(await service.eraseLead(c.get("actor")!, c.req.valid("param").id))
  )

export type LeadsRoutes = typeof leadsRoutes
