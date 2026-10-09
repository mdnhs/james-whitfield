import "server-only"

import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
import { requestId } from "hono/request-id"
import { secureHeaders } from "hono/secure-headers"

import { getAuth } from "@/server/auth/auth"

import { errorBody, handleError } from "./errors"
import { adminRoutes } from "./routes/admin"
import { health } from "./routes/health"
import type { AppEnv } from "./types"

const ADMIN_BODY_LIMIT = 1024 * 1024

// docs/brief.md §8.1. Routes are chained so `AppType` carries their types to
// the admin RPC client.
export const app = new Hono<AppEnv>()
  .basePath("/api")
  .use(requestId())
  .use(secureHeaders())
  // The API is not content: keep it (errors included) out of search indexes.
  .use(async (c, next) => {
    c.header("X-Robots-Tag", "noindex")
    await next()
  })
  .use(
    "/v1/admin/*",
    bodyLimit({
      maxSize: ADMIN_BODY_LIMIT,
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
  .on(["GET", "POST"], "/auth/*", (c) => getAuth().handler(c.req.raw))
  .route("/v1/health", health)
  .route("/v1/admin", adminRoutes)

app.onError(handleError)
app.notFound((c) =>
  c.json(errorBody("NOT_FOUND", "Route not found", c.get("requestId")), 404)
)

export type AppType = typeof app
