import "server-only"

import { Hono } from "hono"

import { sanitizeUrl } from "@/lib/tracking/sanitize"
import { publicLimit } from "@/server/api/middleware/public-limit"
import type { AppEnv } from "@/server/api/types"

// Report-Only CSP violations (Ruling R1). Logged without query strings: the
// document may be a newsletter link with a token in it.
export const cspReportRoutes = new Hono<AppEnv>().post(
  "/",
  publicLimit("csp", { limit: 60, windowMs: 10 * 60_000 }),
  async (c) => {
    const body = (await c.req.json().catch(() => null)) as {
      "csp-report"?: Record<string, unknown>
    } | null
    const report = body?.["csp-report"]
    if (report) {
      const text = (key: string) =>
        typeof report[key] === "string" ? (report[key] as string) : ""
      console.warn(
        "[csp]",
        text("violated-directive").slice(0, 60),
        sanitizeUrl(text("blocked-uri")) || text("blocked-uri").slice(0, 20),
        sanitizeUrl(text("document-uri"))
      )
    }
    return c.body(null, 204)
  }
)
