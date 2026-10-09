import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { createMiddleware } from "hono/factory"
import * as z from "zod"

import {
  EDITABLE_GLOBAL_KEYS,
  GLOBAL_ACCESS,
} from "@/lib/content/global-access"
import { ApiError, validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import {
  getGlobal,
  globalRevisions,
  restoreGlobal,
  saveGlobal,
} from "./service"

const KeyParam = z.object({ key: z.enum(EDITABLE_GLOBAL_KEYS) })
const RevisionParam = KeyParam.extend({ rev: z.uuid() })
const SaveInput = z.object({
  version: z.number().int().min(0),
  value: z.unknown(),
})
const VersionInput = z.object({ version: z.number().int().min(0) })

// The permission depends on the key (docs/brief.md §6.4), so can() runs once
// the key is known. Unknown keys, and those with dedicated endpoints, 404.
const canGlobal = (mode: "read" | "update") =>
  createMiddleware<AppEnv>(async (c, next) => {
    const parsed = KeyParam.safeParse({ key: c.req.param("key") })
    if (!parsed.success)
      throw new ApiError("NOT_FOUND", "No such settings document")
    await can(GLOBAL_ACCESS[parsed.data.key][mode])(c, next)
  })

export const globalsRoutes = new Hono<AppEnv>()
  .get(
    "/:key",
    canGlobal("read"),
    zValidator("param", KeyParam, validationHook),
    async (c) => c.json(await getGlobal(c.req.valid("param").key))
  )
  .put(
    "/:key",
    canGlobal("update"),
    zValidator("param", KeyParam, validationHook),
    zValidator("json", SaveInput, validationHook),
    async (c) =>
      c.json(
        await saveGlobal(
          c.get("actor")!,
          c.req.valid("param").key,
          c.req.valid("json")
        )
      )
  )
  .get(
    "/:key/revisions",
    canGlobal("read"),
    zValidator("param", KeyParam, validationHook),
    async (c) => c.json(await globalRevisions(c.req.valid("param").key))
  )
  .post(
    "/:key/revisions/:rev/restore",
    canGlobal("update"),
    zValidator("param", RevisionParam, validationHook),
    zValidator("json", VersionInput, validationHook),
    async (c) => {
      const { key, rev } = c.req.valid("param")
      return c.json(
        await restoreGlobal(
          c.get("actor")!,
          key,
          rev,
          c.req.valid("json").version
        )
      )
    }
  )

export type GlobalsRoutes = typeof globalsRoutes
