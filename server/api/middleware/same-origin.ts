import "server-only"

import { createMiddleware } from "hono/factory"

import { getEnv } from "@/server/env"

import { ApiError } from "../errors"
import type { AppEnv } from "../types"

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

// Cookie-authenticated mutations must come from our own pages (CSRF defence
// in depth on top of SameSite=Lax cookies).
export const sameOrigin = createMiddleware<AppEnv>(async (c, next) => {
  if (!SAFE_METHODS.has(c.req.method)) {
    const origin = c.req.header("origin")
    const fetchSite = c.req.header("sec-fetch-site")
    const expected = new URL(getEnv().SITE_URL).origin
    const allowed = origin ? origin === expected : fetchSite === "same-origin"
    if (!allowed) throw new ApiError("FORBIDDEN", "Cross-site request blocked")
  }
  await next()
})
