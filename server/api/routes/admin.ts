import "server-only"

import { Hono } from "hono"

import { accountRoutes } from "@/server/modules/account/routes"
import { articlesRoutes } from "@/server/modules/articles/routes"
import { auditRoutes } from "@/server/modules/audit/routes"
import { collectionsRoutes } from "@/server/modules/collections/routes"
import { dashboardRoutes } from "@/server/modules/dashboard/routes"
import { leadsRoutes } from "@/server/modules/leads/routes"
import { mediaRoutes } from "@/server/modules/media/routes"
import { newsletterRoutes } from "@/server/modules/newsletter/routes"
import { globalsRoutes } from "@/server/modules/globals/routes"
import { pagesRoutes } from "@/server/modules/pages/routes"
import { previewRoutes } from "@/server/modules/preview/routes"
import { searchRoutes } from "@/server/modules/search/routes"
import { seoRoutes } from "@/server/modules/seo/routes"
import { meRoutes } from "@/server/modules/session/routes"
import {
  authorsRoutes,
  categoriesRoutes,
} from "@/server/modules/taxonomy/routes"
import { trackingRoutes } from "@/server/modules/tracking/routes"
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
  .route("/preview", previewRoutes)
  .route("/pages", pagesRoutes)
  .route("/collections", collectionsRoutes)
  .route("/globals", globalsRoutes)
  .route("/media", mediaRoutes)
  .route("/articles", articlesRoutes)
  .route("/categories", categoriesRoutes)
  .route("/authors", authorsRoutes)
  .route("/search", searchRoutes)
  .route("/dashboard", dashboardRoutes)
  .route("/audit", auditRoutes)
  .route("/users", usersRoutes)
  .route("/leads", leadsRoutes)
  .route("/newsletter", newsletterRoutes)
  .route("/account", accountRoutes)
  .route("/seo", seoRoutes)
  .route("/tracking", trackingRoutes)
