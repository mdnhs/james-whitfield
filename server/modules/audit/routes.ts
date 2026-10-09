import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import * as z from "zod"

import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import { listAuditEntries } from "./service"

const ListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const auditRoutes = new Hono<AppEnv>().get(
  "/",
  can({ audit: ["read"] }),
  zValidator("query", ListQuery, validationHook),
  async (c) => c.json(await listAuditEntries(c.req.valid("query")))
)

export type AuditRoutes = typeof auditRoutes
