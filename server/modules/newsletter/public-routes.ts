import "server-only"

import { Hono } from "hono"

import { publicLimit } from "@/server/api/middleware/public-limit"
import type { AppEnv } from "@/server/api/types"
import { clientIp } from "@/server/lib/client-ip"

import { confirm, NEWSLETTER_LIMIT, subscribe, unsubscribe } from "./service"

export const newsletterPublicRoutes = new Hono<AppEnv>()
  .post("/", publicLimit("newsletter", NEWSLETTER_LIMIT), async (c) => {
    await subscribe(await c.req.json().catch(() => ({})), {
      ip: clientIp(c.req.raw.headers),
    })
    return c.json({ ok: true as const }, 201)
  })
  // GET with a one-time token: a scanner that prefetches the link confirms
  // the address, which is harmless. Unsubscribing is POST-only for that reason.
  .get("/confirm", async (c) => {
    const ok = await confirm(c.req.query("token") ?? "")
    return c.redirect(ok ? "/newsletter/confirmed" : "/newsletter/invalid", 303)
  })
  .post("/unsubscribe", async (c) => {
    const type = c.req.header("content-type") ?? ""
    const token = type.includes("application/json")
      ? String(
          ((await c.req.json().catch(() => ({}))) as { token?: unknown })
            .token ?? ""
        )
      : String(
          (
            (await c.req.parseBody().catch(() => ({}))) as {
              token?: unknown
            }
          ).token ?? ""
        )
    await unsubscribe(token)
    return c.redirect("/newsletter/unsubscribed", 303)
  })
