import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { createMiddleware } from "hono/factory"
import * as z from "zod"

import { permissionFor } from "@/lib/admin/nav"
import { ApiError, validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import { listDevices, revokeDevice, revokeOtherDevices } from "./service"

// Account self-service belongs to the person, not to an admin viewing as
// them: View-as shows what a role can see, it does not act for the person.
const notViewingAs = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get("actor")?.impersonatedBy) {
    throw new ApiError(
      "IMPERSONATION_READ_ONLY",
      "Account settings can't be changed while viewing as someone"
    )
  }
  await next()
})

// Read from the nav registry, unlike other API routes (which name the
// permission): this API exists only to serve the Account page, so it shares
// that page's gate (every role holds it).
const ownAccount = can(permissionFor("/admin/account"))

const SessionParam = z.object({ id: z.uuid() })

export const accountRoutes = new Hono<AppEnv>()
  .get("/sessions", ownAccount, notViewingAs, async (c) =>
    c.json(await listDevices(c.get("actor")!))
  )
  .delete(
    "/sessions/:id",
    ownAccount,
    notViewingAs,
    zValidator("param", SessionParam, validationHook),
    async (c) => {
      await revokeDevice(c.get("actor")!, c.req.valid("param").id)
      return c.json({ ok: true })
    }
  )
  .post("/sessions/revoke-others", ownAccount, notViewingAs, async (c) =>
    c.json(await revokeOtherDevices(c.get("actor")!))
  )

export type AccountRoutes = typeof accountRoutes
