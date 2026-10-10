import "server-only"

import { Hono } from "hono"

import { publicLimit } from "@/server/api/middleware/public-limit"
import type { AppEnv } from "@/server/api/types"
import { clientIp } from "@/server/lib/client-ip"

import { issueStamp } from "./stamp"
import { LEAD_LIMIT, submitLead } from "./submit"

export const leadsPublicRoutes = new Hono<AppEnv>()
  .get("/stamp", (c) => c.json({ stamp: issueStamp() }))
  // The body is parsed by the service: spam is captured before Zod (§13).
  .post("/", publicLimit("lead", LEAD_LIMIT), async (c) => {
    const body = await c.req.json().catch(() => ({}))
    await submitLead(body, {
      ip: clientIp(c.req.raw.headers),
      userAgent: c.req.header("user-agent") ?? "",
      cookie: c.req.header("cookie") ?? null,
    })
    return c.json({ ok: true as const }, 201)
  })
