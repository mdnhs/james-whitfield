import "server-only"

import { sql } from "drizzle-orm"
import { Hono } from "hono"

import { getDb } from "@/server/db/client"

import { errorBody } from "../errors"
import type { AppEnv } from "../types"

// Used by the Docker HEALTHCHECK and uptime monitors (brief §15).
export const health = new Hono<AppEnv>().get("/", async (c) => {
  try {
    await getDb().execute(sql`select 1`)
    return c.json({ status: "ok" as const, db: "ok" as const })
  } catch {
    return c.json(
      errorBody("UNAVAILABLE", "Database unreachable", c.get("requestId")),
      503
    )
  }
})
