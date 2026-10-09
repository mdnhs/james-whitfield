import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

import { validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import { InviteInput } from "./schema"
import { inviteUser } from "./service"

export const usersRoutes = new Hono<AppEnv>().post(
  "/invite",
  can({ user: ["create"] }),
  zValidator("json", InviteInput, validationHook),
  async (c) => {
    const actor = c.get("actor")!
    const result = await inviteUser(
      actor,
      c.req.valid("json"),
      c.req.raw.headers
    )
    return c.json(result, 201)
  }
)
