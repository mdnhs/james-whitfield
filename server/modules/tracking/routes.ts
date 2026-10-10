import "server-only"

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

import { ApiError, validationHook } from "@/server/api/errors"
import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"
import { takeToken } from "@/server/lib/rate-limit"

import { TrackingUpdate } from "./schema"
import { getTrackingAdmin, saveTracking, sendTestEvent } from "./service"

// docs/brief.md §8.3 Marketing row.
export const trackingRoutes = new Hono<AppEnv>()
  .get("/", can({ tracking: ["read"] }), async (c) =>
    c.json(await getTrackingAdmin())
  )
  .put(
    "/",
    can({ tracking: ["update"] }),
    zValidator("json", TrackingUpdate, validationHook),
    async (c) =>
      c.json(await saveTracking(c.get("actor")!, c.req.valid("json")))
  )
  .post("/test-capi", can({ tracking: ["update"] }), async (c) => {
    const actor = c.get("actor")!
    // Each call reaches Meta: 5 a minute per user is plenty for a manual test.
    if (
      !takeToken(`capi-test:${actor.userId}`, { limit: 5, windowMs: 60_000 })
    ) {
      throw new ApiError(
        "RATE_LIMITED",
        "Too many test events. Wait a minute and try again."
      )
    }
    return c.json(await sendTestEvent(actor))
  })

export type TrackingRoutes = typeof trackingRoutes
