import "server-only"

import { Hono } from "hono"

import { auditRoutes } from "@/server/modules/audit/routes"
import { dashboardRoutes } from "@/server/modules/dashboard/routes"
import { searchRoutes } from "@/server/modules/search/routes"
import { meRoutes } from "@/server/modules/session/routes"
import { usersRoutes } from "@/server/modules/users/routes"

import { session, signedIn, twoFactorComplete } from "../middleware/auth"
import { sameOrigin } from "../middleware/same-origin"
import type { AppEnv } from "../types"

export const adminRoutes = new Hono<AppEnv>()
  .use(session, signedIn, sameOrigin)
  .route("/me", meRoutes)
  // Everything below needs 2FA set up for owners and admins. /me stays above
  // it: its handler answers before this runs.
  .use(twoFactorComplete)
  .route("/search", searchRoutes)
  .route("/dashboard", dashboardRoutes)
  .route("/audit", auditRoutes)
  .route("/users", usersRoutes)
