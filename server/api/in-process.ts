import "server-only"

import { hc } from "hono/client"
import { headers } from "next/headers"

import type { AuditRoutes } from "@/server/modules/audit/routes"

import { app } from "./app"

// Admin RSC prefetches call the Hono stack in-process: the same session,
// 2FA gate, can() and Zod as the browser, no network hop, and data in
// exactly the shape the client queries expect. Never for public pages.
const ORIGIN = "http://in-process"

async function forwarded(cookie?: string) {
  return { cookie: cookie ?? (await headers()).get("cookie") ?? "" }
}

export function inProcessAuditApi(cookie?: string) {
  return hc<AuditRoutes>(`${ORIGIN}/api/v1/admin/audit`, {
    fetch: app.request,
    headers: () => forwarded(cookie),
  })
}
