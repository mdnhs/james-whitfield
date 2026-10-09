import "server-only"

import { Hono } from "hono"

import { permissionMap } from "@/lib/auth/permissions"
import { auditRoutes } from "@/server/modules/audit/routes"
import { usersRoutes } from "@/server/modules/users/routes"

import { session, signedIn, twoFactorComplete } from "../middleware/auth"
import { sameOrigin } from "../middleware/same-origin"
import type { AppEnv } from "../types"

export const adminRoutes = new Hono<AppEnv>()
  .use(session, signedIn, sameOrigin)
  .get("/me", (c) => {
    const actor = c.get("actor")!
    return c.json({
      user: { id: actor.userId, email: actor.email, name: actor.name },
      roles: actor.roles,
      permissions: permissionMap(actor.roles),
      twoFactorEnabled: actor.twoFactorEnabled,
      impersonatedBy: actor.impersonatedBy,
    })
  })
  // Everything below needs 2FA set up for owners and admins. /me stays above
  // it: it answers before this runs, so the client can still see who it is
  // and send them to setup.
  .use(twoFactorComplete)
  .route("/audit", auditRoutes)
  .route("/users", usersRoutes)
