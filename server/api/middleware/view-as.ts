import "server-only"

import { createMiddleware } from "hono/factory"

import { ApiError } from "../errors"
import type { AppEnv } from "../types"

// View-as shows what a role can see; it never changes anyone's access or
// account (docs/brief.md §7.4; Rulings R8 and the Phase 2 account ruling).
export const notViewingAs = (message: string) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (c.get("actor")?.impersonatedBy) {
      throw new ApiError("IMPERSONATION_READ_ONLY", message)
    }
    await next()
  })
