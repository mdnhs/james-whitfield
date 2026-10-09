import "server-only"

import { Hono } from "hono"

import { can } from "@/server/api/middleware/auth"
import type { AppEnv } from "@/server/api/types"

import { getDashboard } from "./service"

export const dashboardRoutes = new Hono<AppEnv>().get(
  "/",
  // API routes gate on the permission itself; pages gate via the nav registry.
  can({ dashboard: ["view"] }),
  async (c) => c.json(await getDashboard(c.get("actor")!))
)

export type DashboardRoutes = typeof dashboardRoutes
