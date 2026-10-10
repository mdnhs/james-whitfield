import "server-only"

import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"

import { consentPublicRoutes } from "@/server/modules/consent/public-routes"
import { leadsPublicRoutes } from "@/server/modules/leads/public-routes"
import { newsletterPublicRoutes } from "@/server/modules/newsletter/public-routes"
import { cspReportRoutes } from "@/server/modules/security/csp-report"

import { errorBody } from "../errors"
import type { AppEnv } from "../types"

const PUBLIC_BODY_LIMIT = 64 * 1024

export const publicRoutes = new Hono<AppEnv>()
  .use(async (c, next) => {
    await next()
    c.header("Cache-Control", "no-store")
  })
  .use(
    bodyLimit({
      maxSize: PUBLIC_BODY_LIMIT,
      onError: (c) =>
        c.json(
          errorBody(
            "PAYLOAD_TOO_LARGE",
            "Request body is too large",
            c.get("requestId")
          ),
          413
        ),
    })
  )
  .route("/consent", consentPublicRoutes)
  .route("/leads", leadsPublicRoutes)
  .route("/newsletter", newsletterPublicRoutes)
  .route("/csp-report", cspReportRoutes)
