import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import { AuditListQuery } from "./schema"
import { getAuditFacets, listAuditEntries } from "./service"

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

export type AuditRoutes = typeof auditRoutes
