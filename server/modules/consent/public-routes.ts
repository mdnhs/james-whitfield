import "server-only"

import { Hono } from "hono"

import { publicLimit } from "@/server/api/middleware/public-limit"
import type { AppEnv } from "@/server/api/types"

import { CONSENT_LIMIT, recordConsent } from "./service"

// navigator.sendBeacon posts here (docs/brief.md §12.2); the answer is unread.
export const consentPublicRoutes = new Hono<AppEnv>().post(
  "/",
  publicLimit("consent", CONSENT_LIMIT),
  async (c) => {
    await recordConsent(await c.req.json().catch(() => ({})))
    return c.body(null, 204)
  }
)
