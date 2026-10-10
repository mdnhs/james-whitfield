import "server-only"

import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"

import { leadsPublicRoutes } from "@/server/modules/leads/public-routes"
import { newsletterPublicRoutes } from "@/server/modules/newsletter/public-routes"

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
  .route("/leads", leadsPublicRoutes)
  .route("/newsletter", newsletterPublicRoutes)
