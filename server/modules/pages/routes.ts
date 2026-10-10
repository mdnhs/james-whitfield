import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import {
  CreatePageInput,
  DraftInput,
  PageIdParam,
  PageMetaPatch,
  PathInput,
  RevisionParam,
  VersionInput,
} from "./schema"
import * as pagesService from "./service"

const read = can({ page: ["read"] })
const id = zValidator("param", PageIdParam, validationHook)
const version = zValidator("json", VersionInput, validationHook)

export const pagesRoutes = new Hono<AppEnv>()
  .get("/", read, async (c) => c.json(await pagesService.listPages()))
  .post(
    "/",
    can({ page: ["create"] }),
    zValidator("json", CreatePageInput, validationHook),
    async (c) =>
      c.json(
        await pagesService.createPage(c.get("actor")!, c.req.valid("json")),
        201
      )
  )
  .get("/:id", read, id, async (c) =>
    c.json(await pagesService.getPage(c.req.valid("param").id))
  )
  .patch(
    "/:id/draft",
    can({ page: ["update"] }),
    id,
    zValidator("json", DraftInput, validationHook),
    async (c) =>
      c.json(
        await pagesService.saveDraft(
          c.get("actor")!,
          c.req.valid("param").id,
          c.req.valid("json")
        )
      )
  )
  // Ruling R6: custom pages only; a published one leaves a 301 behind.
  .patch(
    "/:id/path",
    can({ page: ["update"] }),
    id,
    zValidator("json", PathInput, validationHook),
    async (c) =>
      c.json(
        await pagesService.changePagePath(
          c.get("actor")!,
          c.req.valid("param").id,
          c.req.valid("json").path
        )
      )
  )
  // seo.update or page.update, depending on the fields: decided in the service.
  .patch(
    "/:id/seo",
    read,
    id,
    zValidator("json", PageMetaPatch, validationHook),
    async (c) =>
      c.json(
        await pagesService.updateMeta(
          c.get("actor")!,
          c.req.valid("param").id,
          c.req.valid("json")
        )
      )
  )
  .post("/:id/publish", can({ page: ["publish"] }), id, version, async (c) =>
    c.json(
      await pagesService.publishPage(
        c.get("actor")!,
        c.req.valid("param").id,
        c.req.valid("json").version
      )
    )
  )
  .post("/:id/discard", can({ page: ["update"] }), id, version, async (c) =>
    c.json(
      await pagesService.discardDraft(
        c.get("actor")!,
        c.req.valid("param").id,
        c.req.valid("json").version
      )
    )
  )
  .get("/:id/revisions", read, id, async (c) =>
    c.json(await pagesService.pageRevisions(c.req.valid("param").id))
  )
  .post(
    "/:id/revisions/:rev/restore",
    can({ page: ["update"] }),
    zValidator("param", RevisionParam, validationHook),
    version,
    async (c) => {
      const { id, rev } = c.req.valid("param")
      return c.json(
        await pagesService.restoreRevision(
          c.get("actor")!,
          id,
          rev,
          c.req.valid("json").version
        )
      )
    }
  )
  .delete("/:id", can({ page: ["delete"] }), id, async (c) =>
    c.json(
      await pagesService.deletePage(c.get("actor")!, c.req.valid("param").id)
    )
  )

export type PagesRoutes = typeof pagesRoutes
