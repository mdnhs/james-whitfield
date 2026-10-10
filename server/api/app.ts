import "server-only"

import { Hono, type Context } from "hono"
import { bodyLimit } from "hono/body-limit"
import { requestId } from "hono/request-id"
import { secureHeaders } from "hono/secure-headers"

import { getAuth } from "@/server/auth/auth"
import { redirectsRoutes } from "@/server/modules/redirects/routes"
import { cronRoutes } from "@/server/modules/scheduler/routes"

import { errorBody, handleError } from "./errors"
import { adminRoutes } from "./routes/admin"
import { health } from "./routes/health"
import { publicRoutes } from "./routes/public"
import type { AppEnv } from "./types"

const ADMIN_BODY_LIMIT = 1024 * 1024
// The upload routes take a 20 MB file plus multipart framing (§8.1).
const UPLOAD_BODY_LIMIT = 21 * 1024 * 1024
const UPLOAD_PATH = /^\/api\/v1\/admin\/media(?:\/[^/]+\/replace)?$/

const tooLarge = (c: Context<AppEnv>) =>
  c.json(
    errorBody(
      "PAYLOAD_TOO_LARGE",
      "Request body is too large",
      c.get("requestId")
    ),
    413
  )
const adminLimit = bodyLimit({ maxSize: ADMIN_BODY_LIMIT, onError: tooLarge })
const uploadLimit = bodyLimit({ maxSize: UPLOAD_BODY_LIMIT, onError: tooLarge })

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
  .use("/v1/admin/*", (c, next) =>
    c.req.method === "POST" && UPLOAD_PATH.test(c.req.path)
      ? uploadLimit(c, next)
      : adminLimit(c, next)
  )
  .on(["GET", "POST"], "/auth/*", (c) => getAuth().handler(c.req.raw))
  .route("/v1/health", health)
  .route("/v1/cron", cronRoutes)
  .route("/v1/redirects", redirectsRoutes)
  .route("/v1/public", publicRoutes)
  .route("/v1/admin", adminRoutes)

app.onError(handleError)
app.notFound((c) =>
  c.json(errorBody("NOT_FOUND", "Route not found", c.get("requestId")), 404)
)

export type AppType = typeof app
