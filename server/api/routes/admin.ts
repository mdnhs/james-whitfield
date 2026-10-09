import "server-only"

import { Hono } from "hono"

import { permissionMap } from "@/lib/auth/permissions"
import { auditRoutes } from "@/server/modules/audit/routes"

import { session, signedIn } from "../middleware/auth"
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
  .route("/audit", auditRoutes)
