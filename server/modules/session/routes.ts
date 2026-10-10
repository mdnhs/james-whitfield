import "server-only"

import { Hono } from "hono"

import { toMePayload } from "@/lib/auth/me"
import type { AppEnv } from "@/server/api/types"

// Who the signed-in user is, for the client.
export const meRoutes = new Hono<AppEnv>().get("/", (c) =>
  c.json(toMePayload(c.get("actor")!))
)
