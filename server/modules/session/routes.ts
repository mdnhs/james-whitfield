import "server-only"

import { Hono } from "hono"

import { toMePayload } from "@/lib/auth/me"
import type { AppEnv } from "@/server/api/types"

// Mounted before the two-factor gate: an owner without 2FA can still learn
// who they are, so the client can send them to setup.
export const meRoutes = new Hono<AppEnv>().get("/", (c) =>
  c.json(toMePayload(c.get("actor")!))
)
