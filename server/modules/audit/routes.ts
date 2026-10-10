import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import * as z from "zod"

import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import { AuditExportQuery, AuditListQuery } from "./schema"
import {
  exportAuditCsv,
  getAuditEntry,
  getAuditFacets,
  listAuditEntries,
} from "./service"

// Order matters: /facets and /export.csv before /:id.
export const auditRoutes = new Hono<AppEnv>()
  .get(
    "/",
    can({ audit: ["read"] }),
    zValidator("query", AuditListQuery, validationHook),
    async (c) => c.json(await listAuditEntries(c.req.valid("query")))
  )
  .get("/facets", can({ audit: ["read"] }), async (c) =>
    c.json(await getAuditFacets())
  )
  .get(
    "/export.csv",
    can({ audit: ["read"] }),
    zValidator("query", AuditExportQuery, validationHook),
    async (c) => {
      const csv = await exportAuditCsv(c.get("actor")!, c.req.valid("query"))
      const day = new Date().toISOString().slice(0, 10)
      return c.body(csv, 200, {
        "Cache-Control": "no-store",
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="activity-${day}.csv"`,
      })
    }
  )
  .get(
    "/:id",
    can({ audit: ["read"] }),
    zValidator("param", z.object({ id: z.uuid() }), validationHook),
    async (c) => c.json(await getAuditEntry(c.req.valid("param").id))
  )

export type AuditRoutes = typeof auditRoutes
