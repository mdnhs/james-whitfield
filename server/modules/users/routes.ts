import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import * as z from "zod"

import {
  AuthorLinkInput,
  BanInput,
  InviteInput,
  RolesInput,
  UserListQuery,
} from "@/lib/users/schema"
import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import { notViewingAs } from "@/server/api/middleware/view-as"
import type { AppEnv } from "@/server/api/types"

import * as manage from "./manage"
import { inviteUser } from "./service"

const IdParam = z.object({ id: z.uuid() })
const id = zValidator("param", IdParam, validationHook)
const viewing = notViewingAs("Access can't be changed while viewing as someone")

// docs/brief.md §8.3. Validate, authorise, call the service.
export const usersRoutes = new Hono<AppEnv>()
  .get(
    "/",
    can({ user: ["list"] }),
    zValidator("query", UserListQuery, validationHook),
    async (c) => c.json(await manage.listUsers(c.req.valid("query")))
  )
  .post(
    "/invite",
    can({ user: ["create"] }),
    viewing,
    zValidator("json", InviteInput, validationHook),
    async (c) =>
      c.json(
        await inviteUser(
          c.get("actor")!,
          c.req.valid("json"),
          c.req.raw.headers
        ),
        201
      )
  )
  .patch(
    "/:id/role",
    can({ user: ["set-role"] }),
    viewing,
    id,
    zValidator("json", RolesInput, validationHook),
    async (c) =>
      c.json(
        await manage.setRoles(
          c.get("actor")!,
          c.req.valid("param").id,
          c.req.valid("json")
        )
      )
  )
  .post(
    "/:id/ban",
    can({ user: ["ban"] }),
    viewing,
    id,
    zValidator("json", BanInput, validationHook),
    async (c) =>
      c.json(
        await manage.banUser(
          c.get("actor")!,
          c.req.valid("param").id,
          c.req.valid("json")
        )
      )
  )
  .post("/:id/unban", can({ user: ["ban"] }), viewing, id, async (c) =>
    c.json(await manage.unbanUser(c.get("actor")!, c.req.valid("param").id))
  )
  .delete(
    "/:id/sessions",
    can({ session: ["revoke"] }),
    viewing,
    id,
    async (c) =>
      c.json(
        await manage.revokeUserSessions(
          c.get("actor")!,
          c.req.valid("param").id
        )
      )
  )
  .post(
    "/:id/resend-invite",
    can({ user: ["create"] }),
    viewing,
    id,
    async (c) =>
      c.json(
        await manage.resendInvite(c.get("actor")!, c.req.valid("param").id)
      )
  )
  .put(
    "/:id/author",
    can({ user: ["update"] }),
    viewing,
    id,
    zValidator("json", AuthorLinkInput, validationHook),
    async (c) =>
      c.json(
        await manage.linkAuthor(
          c.get("actor")!,
          c.req.valid("param").id,
          c.req.valid("json")
        )
      )
  )
  .delete("/:id", can({ user: ["delete"] }), viewing, id, async (c) =>
    c.json(await manage.deleteUser(c.get("actor")!, c.req.valid("param").id))
  )

export type UsersRoutes = typeof usersRoutes
