import "server-only"

import { createMiddleware } from "hono/factory"

import { hasPermission, type Permissions } from "@/lib/auth/permissions"
import { toActor } from "@/server/auth/actor"
import { getAuth } from "@/server/auth/auth"

import { ApiError } from "../errors"
import type { AppEnv } from "../types"

// Full session check against the database: the 5-minute cookie cache is
// bypassed, so bans and role changes apply on the next request.
export const session = createMiddleware<AppEnv>(async (c, next) => {
  const result = await getAuth().api.getSession({
    headers: c.req.raw.headers,
    query: { disableCookieCache: true },
  })
  c.set("actor", result ? toActor(result) : null)
  await next()
})

export const signedIn = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("actor"))
    throw new ApiError("UNAUTHENTICATED", "Sign in to continue")
  await next()
})

export const can = (permissions: Permissions) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const actor = c.get("actor")
    if (!actor) throw new ApiError("UNAUTHENTICATED", "Sign in to continue")
    if (!hasPermission(actor.roles, permissions)) {
      throw new ApiError("FORBIDDEN", "You don't have permission to do that")
    }
    await next()
  })
