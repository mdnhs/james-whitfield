import "server-only"

import { sql } from "drizzle-orm"
import { Hono } from "hono"

import { getDb } from "@/server/db/client"

import { errorBody } from "../errors"
import type { AppEnv } from "../types"

// "/live" is liveness (process is up, no DB): the Docker HEALTHCHECK, so a
// database blip never restarts the container. "/" is readiness (DB reachable):
// load balancers and uptime monitors (brief §15).
export const health = new Hono<AppEnv>()
  .get("/live", (c) => c.json({ status: "ok" as const }))
  .get("/", async (c) => {
    try {
      await getDb().execute(sql`select 1`)
      return c.json({ status: "ok" as const, db: "ok" as const })
    } catch (error) {
      console.error(`[api] ${c.get("requestId")} health check failed`, error)
      return c.json(
        errorBody("UNAVAILABLE", "Database unreachable", c.get("requestId")),
        503
      )
    }
  })
