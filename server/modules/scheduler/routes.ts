import "server-only"

import { Hono } from "hono"

import { cronAuth } from "@/server/api/middleware/cron"
import type { AppEnv } from "@/server/api/types"

import { runTick } from "./service"

export const cronRoutes = new Hono<AppEnv>()
  .use(cronAuth)
  .post("/tick", async (c) => c.json(await runTick()))
