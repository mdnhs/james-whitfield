import "server-only"

import { Hono } from "hono"

import { can } from "@/server/api/middleware/auth"
import { notViewingAs } from "@/server/api/middleware/view-as"
import type { AppEnv } from "@/server/api/types"

import { listNotifications, markSeen } from "./service"

export const notificationsRoutes = new Hono<AppEnv>()
  .get("/", can({ dashboard: ["view"] }), async (c) =>
    c.json(await listNotifications(c.get("actor")!))
  )
  .post(
    "/seen",
    can({ dashboard: ["view"] }),
    notViewingAs("Viewing as someone never marks their notifications as read"),
    async (c) => c.json(await markSeen(c.get("actor")!))
  )

export type NotificationsRoutes = typeof notificationsRoutes
