import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import {
  ArticleIdParam,
  ArticleListQuery,
  ArticleRevisionParam,
  ArticleSeoPatch,
  DraftInput,
  NewArticleInput,
  ScheduleInput,
  UnpublishInput,
  VersionInput,
} from "./schema"
import * as service from "./service"

const read = can({ article: ["read"] })
const update = can({ article: ["update"] })
const id = zValidator("param", ArticleIdParam, validationHook)

export const articlesRoutes = new Hono<AppEnv>()
  .get(
    "/",
    read,
    zValidator("query", ArticleListQuery, validationHook),
    async (c) => c.json(await service.listArticles(c.req.valid("query")))
  )
  .post(
    "/",
    can({ article: ["create"] }),
    zValidator("json", NewArticleInput, validationHook),
    async (c) =>
      c.json(
        await service.createArticle(c.get("actor")!, c.req.valid("json")),
        201
      )
  )
  .get("/:id", read, id, async (c) =>
    c.json(await service.getArticle(c.get("actor")!, c.req.valid("param").id))
  )
  .patch(
    "/:id/draft",
    update,
    id,
    zValidator("json", DraftInput, validationHook),
    async (c) =>
      c.json(
        await service.saveArticleDraft(
          c.get("actor")!,
          c.req.valid("param").id,
          c.req.valid("json")
        )
      )
  )
  // seo.update decided in the service, like pages.
  .patch(
    "/:id/seo",
    read,
    id,
    zValidator("json", ArticleSeoPatch, validationHook),
    async (c) =>
      c.json(
        await service.updateArticleSeo(
          c.get("actor")!,
          c.req.valid("param").id,
          c.req.valid("json")
        )
      )
  )
  .post("/:id/submit", update, id, async (c) =>
    c.json(
      await service.submitForReview(c.get("actor")!, c.req.valid("param").id)
    )
  )
  .post(
    "/:id/publish",
    can({ article: ["publish"] }),
    id,
    zValidator("json", VersionInput, validationHook),
    async (c) =>
      c.json(
        await service.publishArticle(
          c.get("actor")!,
          c.req.valid("param").id,
          c.req.valid("json").version
        )
      )
  )
  .post(
    "/:id/schedule",
    can({ article: ["publish"] }),
    id,
    zValidator("json", ScheduleInput, validationHook),
    async (c) =>
      c.json(
        await service.scheduleArticle(
          c.get("actor")!,
          c.req.valid("param").id,
          c.req.valid("json")
        )
      )
  )
  .post(
    "/:id/unpublish",
    can({ article: ["publish"] }),
    id,
    zValidator("json", UnpublishInput, validationHook),
    async (c) =>
      c.json(
        await service.unpublishArticle(
          c.get("actor")!,
          c.req.valid("param").id,
          c.req.valid("json")
        )
      )
  )
  .get("/:id/revisions", read, id, async (c) =>
    c.json(await service.articleRevisions(c.req.valid("param").id))
  )
  .post(
    "/:id/revisions/:rev/restore",
    update,
    zValidator("param", ArticleRevisionParam, validationHook),
    zValidator("json", VersionInput, validationHook),
    async (c) => {
      const { id: articleId, rev } = c.req.valid("param")
      return c.json(
        await service.restoreArticleRevision(
          c.get("actor")!,
          articleId,
          rev,
          c.req.valid("json").version
        )
      )
    }
  )
  .delete("/:id", can({ article: ["delete"] }), id, async (c) =>
    c.json(
      await service.deleteArticle(c.get("actor")!, c.req.valid("param").id)
    )
  )

export type ArticlesRoutes = typeof articlesRoutes
