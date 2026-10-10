import "server-only"

import { createHash, timingSafeEqual } from "node:crypto"
import { createMiddleware } from "hono/factory"

import { ApiError } from "@/server/api/errors"
import type { AppEnv } from "@/server/api/types"
import { getEnv } from "@/server/env"

const digest = (value: string) => createHash("sha256").update(value).digest()

// docs/brief.md §8.1: /v1/cron/* → bearer CRON_SECRET. Hashing first makes
// the comparison constant-time whatever the lengths.
export const cronAuth = createMiddleware<AppEnv>(async (c, next) => {
  const secret = getEnv().CRON_SECRET
  const given = c.req.header("authorization")?.replace(/^Bearer /, "") ?? ""
  if (!secret || !timingSafeEqual(digest(given), digest(secret))) {
    throw new ApiError("UNAUTHENTICATED", "Invalid cron credentials")
  }
  await next()
})
