import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { createMiddleware } from "hono/factory"
import * as z from "zod"

import { hasPermission } from "@/lib/auth/permissions"
import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import { notViewingAs } from "@/server/api/middleware/view-as"
import type { AppEnv } from "@/server/api/types"

import { touchPresence } from "./repo"
import * as staff from "./staff"

const IdParam = z.object({ id: z.uuid() })
const ListQuery = z.object({
  status: z.enum(["open", "closed"]).default("open"),
  cursor: z.string().max(100).optional(),
})
const DetailQuery = z.object({
  after: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
})
const ReplyBody = z.object({ body: z.string().trim().min(1).max(2000) })
const AssignBody = z.object({ userId: z.uuid().nullable() })
const ReadBody = z.object({
  upTo: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
})

// Staff who can reply count as online while they use the inbox.
const presence = createMiddleware<AppEnv>(async (c, next) => {
  const actor = c.get("actor")
  if (
    actor &&
    !actor.impersonatedBy &&
    hasPermission(actor.roles, { chat: ["reply"] })
  ) {
    await touchPresence(actor.userId)
  }
  await next()
})

const readOnly = (what: string) =>
  notViewingAs(`You can't ${what} while viewing as someone`)

// Static paths before /:id.
export const chatRoutes = new Hono<AppEnv>()
  .use(presence)
  .get(
    "/",
    can({ chat: ["read"] }),
    zValidator("query", ListQuery, validationHook),
    async (c) => c.json(await staff.list(c.req.valid("query")))
  )
  .get("/unread", can({ chat: ["read"] }), async (c) =>
    c.json(await staff.unread())
  )
  .get(
    "/:id",
    can({ chat: ["read"] }),
    zValidator("param", IdParam, validationHook),
    zValidator("query", DetailQuery, validationHook),
    async (c) =>
      c.json(
        await staff.detail(c.req.valid("param").id, c.req.valid("query").after)
      )
  )
  .post(
    "/:id/messages",
    can({ chat: ["reply"] }),
    readOnly("reply to chats"),
    zValidator("param", IdParam, validationHook),
    zValidator("json", ReplyBody, validationHook),
    async (c) =>
      c.json(
        await staff.reply(
          c.get("actor")!,
          c.req.valid("param").id,
          c.req.valid("json").body
        ),
        201
      )
  )
  .post(
    "/:id/takeover",
    can({ chat: ["reply"] }),
    readOnly("take over chats"),
    zValidator("param", IdParam, validationHook),
    async (c) =>
      c.json(await staff.takeover(c.get("actor")!, c.req.valid("param").id))
  )
  .post(
    "/:id/handback",
    can({ chat: ["reply"] }),
    readOnly("hand chats back"),
    zValidator("param", IdParam, validationHook),
    async (c) =>
      c.json(await staff.handback(c.get("actor")!, c.req.valid("param").id))
  )
  .post(
    "/:id/assign",
    can({ chat: ["manage"] }),
    readOnly("assign chats"),
    zValidator("param", IdParam, validationHook),
    zValidator("json", AssignBody, validationHook),
    async (c) =>
      c.json(
        await staff.assign(
          c.get("actor")!,
          c.req.valid("param").id,
          c.req.valid("json").userId
        )
      )
  )
  .post(
    "/:id/read",
    can({ chat: ["read"] }),
    readOnly("mark chats as read"),
    zValidator("param", IdParam, validationHook),
    zValidator("json", ReadBody, validationHook),
    async (c) =>
      c.json(
        await staff.read(c.req.valid("param").id, c.req.valid("json").upTo)
      )
  )
  .post(
    "/:id/close",
    can({ chat: ["reply"] }),
    readOnly("close chats"),
    zValidator("param", IdParam, validationHook),
    async (c) =>
      c.json(await staff.close(c.get("actor")!, c.req.valid("param").id))
  )
  .delete(
    "/:id",
    can({ chat: ["manage"] }),
    readOnly("delete chats"),
    zValidator("param", IdParam, validationHook),
    async (c) =>
      c.json(await staff.remove(c.get("actor")!, c.req.valid("param").id))
  )

export type ChatRoutes = typeof chatRoutes
